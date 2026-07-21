import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { FraudAutoAction, FraudFlagStatus, FraudSeverity, UserStatus } from '@prisma/client';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  autoActionFor,
  FRAUD_CONFIG,
  FRAUD_DEFAULTS,
  FRAUD_RULES,
  FraudRuleResult,
  ruleNotTriggered,
} from './fraud-rules';
import { SLIDING_WINDOW, SlidingWindowCounter } from './sliding-window';

export interface RaiseFlagInput {
  userId: string;
  /** stable rule id (FRAUD_RULES.*) or a raw signal rule id */
  rule: string;
  severity: FraudSeverity;
  details?: Record<string, unknown>;
}

export interface RedemptionScreenInput {
  userId: string;
  coinCost: number;
  /** true when coinCost is the maximum in the active catalog */
  isMaxValue: boolean;
  accountAgeHours: number;
}

export interface RedemptionScreenResult {
  forceReview: boolean;
  reason?: string;
}

/**
 * E1 — the durable side of the fraud engine. Rules (velocity, device fan-out,
 * redemption screen) are evaluated here or by the hook adapters; this service is
 * the SINGLE writer to fraud_flags and the only place auto-actions (flag/ban)
 * are applied. It never writes coin_ledger — a held credit simply stays pending.
 *
 * Flags are deduped per (user, rule) while OPEN so a repeatedly-tripped velocity
 * rule doesn't spam the admin queue; the auto-action is still (idempotently)
 * applied on each trip.
 */
@Injectable()
export class FraudEngineService {
  private readonly logger = new Logger(FraudEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    @Inject(SLIDING_WINDOW) private readonly window: SlidingWindowCounter,
    @Optional() @Inject(ALERT_SERVICE) private readonly alerts?: AlertService,
  ) {}

  // ─────────────────────── rule detectors ───────────────────────

  /**
   * Rule 2 — offer velocity: more than `max_completions` credited-offer events
   * for a user inside a sliding `window_minutes` window → HOLD + flag.
   */
  async evaluateOfferVelocity(userId: string): Promise<FraudRuleResult> {
    const max = await this.appConfig.getNumber(
      FRAUD_CONFIG.OFFER_VELOCITY,
      'max_completions',
      FRAUD_DEFAULTS.offerMaxCompletions,
    );
    const windowMinutes = await this.appConfig.getNumber(
      FRAUD_CONFIG.OFFER_VELOCITY,
      'window_minutes',
      FRAUD_DEFAULTS.offerWindowMinutes,
    );
    const count = await this.safeHit(`offer:${userId}`, windowMinutes * 60_000);
    if (count > max) {
      return {
        triggered: true,
        severity: FraudSeverity.medium,
        hold: true,
        reason: 'offer_velocity_exceeded',
        details: { count, max, windowMinutes },
      };
    }
    return ruleNotTriggered();
  }

  /**
   * Rule 1 — multi-accounting: distinct accounts sharing any device fingerprint
   * with this user. Over `flag_over` → flag ALL linked accounts; over
   * `block_over` → additionally HOLD this credit (high severity).
   */
  async evaluateMultiAccount(userId: string): Promise<FraudRuleResult> {
    const flagOver = await this.appConfig.getNumber(
      FRAUD_CONFIG.DEVICE_LIMITS,
      'flag_over',
      FRAUD_DEFAULTS.deviceFlagOver,
    );
    const blockOver = await this.appConfig.getNumber(
      FRAUD_CONFIG.DEVICE_LIMITS,
      'block_over',
      FRAUD_DEFAULTS.deviceBlockOver,
    );

    const linkedUserIds = await this.linkedAccountsByDevice(userId);
    const count = linkedUserIds.length;
    if (count <= flagOver) {
      return ruleNotTriggered();
    }
    const overBlock = count > blockOver;
    return {
      triggered: true,
      severity: overBlock ? FraudSeverity.high : FraudSeverity.medium,
      hold: overBlock,
      reason: 'same_device_multi_account',
      details: { linkedAccounts: count, flagOver, blockOver },
      additionalUserIds: linkedUserIds.filter((id) => id !== userId),
    };
  }

  /** Distinct user ids that share at least one device fingerprint with `userId`. */
  async linkedAccountsByDevice(userId: string): Promise<string[]> {
    const myDevices = await this.prisma.device.findMany({
      where: { userId },
      select: { deviceFingerprint: true },
    });
    const fingerprints = new Set(myDevices.map((d) => d.deviceFingerprint));
    // Fall back to the user's primary device_id column when no device rows exist.
    if (fingerprints.size === 0) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { deviceId: true },
      });
      if (user?.deviceId) fingerprints.add(user.deviceId);
    }
    if (fingerprints.size === 0) return [userId];

    const rows = await this.prisma.device.findMany({
      where: { deviceFingerprint: { in: [...fingerprints] } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const ids = new Set(rows.map((r) => r.userId));
    ids.add(userId);
    return [...ids];
  }

  /**
   * Rule 5 — redemption abuse: a young account (age < config) requesting the
   * max-value gift card is forced to manual review regardless of the normal
   * rules, and a flag is recorded.
   */
  async screenRedemption(input: RedemptionScreenInput): Promise<RedemptionScreenResult> {
    const young = input.accountAgeHours < (await this.redemptionMinAgeHours());
    if (young && input.isMaxValue) {
      await this.raiseFlag({
        userId: input.userId,
        rule: FRAUD_RULES.REDEMPTION_ABUSE,
        severity: FraudSeverity.low,
        details: {
          accountAgeHours: Math.round(input.accountAgeHours * 10) / 10,
          coinCost: input.coinCost,
        },
      });
      return { forceReview: true, reason: 'new_account_max_value_redemption' };
    }
    // Any young-account redemption still routes to review (existing behavior),
    // but only the max-value case raises a durable fraud flag.
    return { forceReview: young, reason: young ? 'new_account_redemption' : undefined };
  }

  async redemptionMinAgeHours(): Promise<number> {
    return this.appConfig.getNumber(
      FRAUD_CONFIG.REDEMPTION_MIN_AGE,
      'hours',
      FRAUD_DEFAULTS.redemptionMinAgeHours,
    );
  }

  // ─────────────────────── flag persistence + auto-actions ───────────────────────

  /**
   * Persist an OPEN fraud_flag (deduped per user+rule) and apply the configured
   * auto-action. Never throws into the caller's path — a detection failure must
   * not fail a credit/redemption. Returns the flag id, or null when deduped.
   */
  async raiseFlag(input: RaiseFlagInput): Promise<string | null> {
    try {
      const autoAction = autoActionFor(input.severity, await this.severityActionMap());

      const existing = await this.prisma.fraudFlag.findFirst({
        where: { userId: input.userId, ruleTriggered: input.rule, status: FraudFlagStatus.open },
        select: { id: true },
      });

      let flagId: string | null = existing?.id ?? null;
      if (!existing) {
        const flag = await this.prisma.fraudFlag.create({
          data: {
            userId: input.userId,
            ruleTriggered: input.rule,
            severity: input.severity,
            autoAction,
          },
          select: { id: true },
        });
        flagId = flag.id;
        this.logger.warn(
          `fraud_flag opened: rule=${input.rule} user=${input.userId} severity=${input.severity} action=${autoAction}`,
        );
      }

      await this.applyAutoAction(input.userId, autoAction);
      await this.emitAlert(input, autoAction);
      return flagId;
    } catch (err) {
      this.logger.error(
        `raiseFlag failed (rule=${input.rule} user=${input.userId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /** Raise the same rule for every affected account (multi-account fan-out). */
  async raiseForMany(
    userIds: string[],
    rule: string,
    severity: FraudSeverity,
    details?: Record<string, unknown>,
  ): Promise<void> {
    for (const userId of new Set(userIds)) {
      await this.raiseFlag({ userId, rule, severity, details });
    }
  }

  /**
   * Apply the auto-action to the user's status (never a coin effect):
   *   flagged_for_review → status=flagged (from active only)
   *   auto_banned        → status=banned
   * Idempotent and monotonic: a banned user is never downgraded to flagged.
   */
  private async applyAutoAction(userId: string, action: FraudAutoAction): Promise<void> {
    if (action === FraudAutoAction.none) return;

    if (action === FraudAutoAction.auto_banned) {
      await this.prisma.user.updateMany({
        where: { id: userId, status: { not: UserStatus.banned } },
        data: { status: UserStatus.banned },
      });
      this.logger.warn(`user ${userId} auto-banned by fraud engine`);
      return;
    }
    // flagged_for_review
    await this.prisma.user.updateMany({
      where: { id: userId, status: UserStatus.active },
      data: { status: UserStatus.flagged },
    });
  }

  private async emitAlert(input: RaiseFlagInput, action: FraudAutoAction): Promise<void> {
    // Only escalate hard actions to the ops channel (data-security §7: contain fast).
    if (action !== FraudAutoAction.auto_banned) return;
    await this.alerts?.alert({
      type: 'fraud_auto_ban',
      message: `Fraud rule ${input.rule} auto-banned user ${input.userId}`,
      details: { ...input.details, severity: input.severity },
    });
  }

  private async severityActionMap(): Promise<Record<string, unknown> | undefined> {
    const value = await this.appConfig.get(FRAUD_CONFIG.SEVERITY_ACTIONS);
    return value !== null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private async safeHit(key: string, windowMs: number): Promise<number> {
    try {
      return await this.window.hit(key, windowMs);
    } catch (err) {
      // A Redis blip must not fail the credit path — treat as "no velocity".
      this.logger.error(`sliding-window hit failed for ${key}: ${(err as Error).message}`);
      return 0;
    }
  }
}
