import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { LedgerSourceType, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FRAUD_SIGNAL_HOOK, FraudSignalHook } from '../fraud/fraud-signal.hook';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';

export interface OnUserEarnedParams {
  /** the user who just earned coins (the potential referred user) */
  userId: string;
  /** positive number of coins credited to that user */
  amount: number;
  /** id of the coin_ledger row that credited them (the fan-out anchor) */
  sourceLedgerId: string;
}

export interface MyCodeView {
  code: string;
}

export interface ReferralStatsView {
  code: string;
  referred_count: number;
  active_referrals: number;
  total_earned_from_referrals: number;
}

/** One referred user's row in the referral breakdown (H2). */
export interface ReferredUserView {
  display_name: string;
  joined_at: string;
  /** the referred user's positive ledger credits inside the referral window */
  their_earnings_total: number;
  /** what the caller (referrer) earned from this user, summed from referral_earnings */
  commission_earned_by_me: number;
  /** whether the bonus window is still open */
  window_active: boolean;
  valid_until: string;
}

export interface ReferralBreakdownView {
  referred: ReferredUserView[];
  totals: {
    referred_count: number;
    active_count: number;
    total_commission: number;
  };
  config: {
    bonus_percent: number;
    window_days: number;
  };
}

const REFERRAL_CONFIG_KEY = 'referral.bonus_percent';
const DEFAULT_BONUS_PERCENT = 10;
const DEFAULT_WINDOW_DAYS = 30;

/**
 * Referral earnings fan-out (D4.3) + read endpoints (D4.1).
 *
 * `onUserEarned` is invoked AFTER any successful coin credit to a user
 * (postback offer/ad credits, game, streak, bonus). If that user was referred
 * and is inside the referral window, the referrer receives a snapshot percent
 * of the earning. It is:
 *   - server-authoritative: percent comes from the referrals row snapshot,
 *   - idempotent: keyed on the source ledger row, so re-processing a credit
 *     (worker retry, double-call) never double-pays,
 *   - non-blocking: it never throws back into the earner's credit path.
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(FRAUD_SIGNAL_HOOK) private readonly fraudSignal: FraudSignalHook,
    @Optional() @Inject(NOTIFICATION_HOOK) private readonly notifications?: NotificationHook,
  ) {}

  /**
   * Credit the referrer their bonus for a referred user's earning. Safe to call
   * on every credit: no referral / out-of-window / non-positive-bonus / flagged
   * referral all short-circuit to a no-op. Never throws.
   */
  async onUserEarned(params: OnUserEarnedParams): Promise<void> {
    try {
      await this.fanOut(params);
    } catch (err) {
      // Best-effort: the earner's own credit already committed. A failure here
      // must not fail their request; a later retry of the same source credit is
      // idempotent (keyed on sourceLedgerId).
      this.logger.error(
        `referral fan-out failed for source ${params.sourceLedgerId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async fanOut(params: OnUserEarnedParams): Promise<void> {
    const { userId, amount, sourceLedgerId } = params;
    if (!Number.isInteger(amount) || amount <= 0) return; // only positive credits fan out

    const referral = await this.prisma.referral.findUnique({ where: { referredId: userId } });
    if (!referral) return; // user was not referred

    // Idempotency short-circuit: this source earning already paid out.
    const already = await this.prisma.referralEarning.findUnique({ where: { sourceLedgerId } });
    if (already) return;

    // Window: no payout once the referral window has closed.
    if (referral.validUntil.getTime() <= Date.now()) return;

    // Flagged/blocked referral: skip payout (self-referral or fraud hold).
    const [referrer, referred] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: referral.referrerId },
        select: { status: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
    ]);
    if (!referrer || referrer.status === UserStatus.banned) return;
    if (referral.referrerId === userId) {
      await this.fraudSignal.report({
        userId,
        rule: 'self_referral',
        details: { referralId: referral.id, referrerId: referral.referrerId },
      });
      return;
    }
    if (referred && referred.status !== UserStatus.active) {
      // referred user is flagged or banned — hold referral payouts
      await this.fraudSignal.report({
        userId,
        rule: 'self_referral',
        details: {
          referralId: referral.id,
          referrerId: referral.referrerId,
          referredStatus: referred.status,
        },
      });
      return;
    }

    // Rule 3 (self-referral): referrer and referred on the same physical device
    // → block the bonus and flag both accounts. IP isn't retained per-earning,
    // so the device fingerprint is the durable shared-identity signal here.
    if (await this.sharesDevice(referral.referrerId, userId)) {
      await this.fraudSignal.report({
        userId,
        rule: 'self_referral',
        details: { referralId: referral.id, referrerId: referral.referrerId, sharedDevice: true },
      });
      return;
    }

    // Snapshot percent from the referrals row (never current config).
    const percent = referral.bonusPercent.toNumber();
    const bonus = Math.floor((amount * percent) / 100);
    if (bonus <= 0) return; // no zero-value ledger rows

    const result = await this.ledger.record({
      userId: referral.referrerId,
      amount: bonus,
      sourceType: LedgerSourceType.referral,
      sourceRefId: sourceLedgerId,
      // Anchored on the source earning: one bonus per earning, ever.
      idempotencyKey: `referral:${sourceLedgerId}`,
    });
    const bonusLedgerId = result.entry.id;

    try {
      await this.prisma.referralEarning.create({
        data: {
          referralId: referral.id,
          sourceLedgerId,
          bonusLedgerId,
        },
      });
    } catch (err) {
      // A concurrent fan-out won the race and already recorded this earning.
      if (this.isUniqueViolation(err)) return;
      throw err;
    }

    // Notify the referrer of their bonus credit (best-effort, async).
    await this.notifications?.onCredited({
      userId: referral.referrerId,
      coins: bonus,
      sourceType: LedgerSourceType.referral,
      sourceRefId: bonusLedgerId,
    });
  }

  /** True when the two users have any device fingerprint in common. */
  private async sharesDevice(referrerId: string, referredId: string): Promise<boolean> {
    const [referrerDevices, referredDevices] = await Promise.all([
      this.prisma.device.findMany({
        where: { userId: referrerId },
        select: { deviceFingerprint: true },
      }),
      this.prisma.device.findMany({
        where: { userId: referredId },
        select: { deviceFingerprint: true },
      }),
    ]);
    const referrerFps = new Set(referrerDevices.map((d) => d.deviceFingerprint));
    return referredDevices.some((d) => referrerFps.has(d.deviceFingerprint));
  }

  async myCode(userId: string): Promise<MyCodeView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { code: user.referralCode };
  }

  async stats(userId: string): Promise<ReferralStatsView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const [referredCount, activeReferrals, earned] = await Promise.all([
      this.prisma.referral.count({ where: { referrerId: userId } }),
      this.prisma.referral.count({ where: { referrerId: userId, validUntil: { gt: now } } }),
      // authoritative: sum of the referrer's referral-source ledger credits
      this.prisma.coinLedger.aggregate({
        where: { userId, sourceType: LedgerSourceType.referral },
        _sum: { amount: true },
      }),
    ]);

    return {
      code: user.referralCode,
      referred_count: referredCount,
      active_referrals: activeReferrals,
      total_earned_from_referrals: earned._sum.amount ?? 0,
    };
  }

  /**
   * H2 — per-referred-user breakdown for the referrer's Invite page. Each row
   * shows the referred user's in-window earnings and the commission the caller
   * earned from them (derived from referral_earnings → bonus ledger credits).
   * Percent/window in `config` come from the current app_config snapshot.
   */
  async breakdown(userId: string): Promise<ReferralBreakdownView> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const config = await this.referralConfig();
    const now = Date.now();

    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        referred: { select: { displayName: true, createdAt: true } },
        earnings: { include: { bonusLedger: { select: { amount: true } } } },
      },
    });

    const referred = await Promise.all(
      referrals.map(async (r): Promise<ReferredUserView> => {
        // Commission I earned from this user = sum of the referral bonus credits.
        const commission = r.earnings.reduce((acc, e) => acc + e.bonusLedger.amount, 0);
        // Their in-window earnings = positive ledger credits between the referral
        // opening (createdAt) and the window close (validUntil).
        const earned = await this.prisma.coinLedger.aggregate({
          where: {
            userId: r.referredId,
            amount: { gt: 0 },
            createdAt: { gte: r.createdAt, lte: r.validUntil },
          },
          _sum: { amount: true },
        });
        return {
          display_name: r.referred.displayName,
          joined_at: r.referred.createdAt.toISOString(),
          their_earnings_total: earned._sum.amount ?? 0,
          commission_earned_by_me: commission,
          window_active: r.validUntil.getTime() > now,
          valid_until: r.validUntil.toISOString(),
        };
      }),
    );

    return {
      referred,
      totals: {
        referred_count: referred.length,
        active_count: referred.filter((r) => r.window_active).length,
        total_commission: referred.reduce((acc, r) => acc + r.commission_earned_by_me, 0),
      },
      config: {
        bonus_percent: config.percent,
        window_days: config.windowDays,
      },
    };
  }

  /** Current referral percent/window snapshot (mirrors AuthService.referralDefaults). */
  private async referralConfig(): Promise<{ percent: number; windowDays: number }> {
    const row = await this.prisma.appConfig.findFirst({
      where: { key: REFERRAL_CONFIG_KEY },
      orderBy: { version: 'desc' },
    });
    const value = (row?.value ?? {}) as { percent?: unknown; window_days?: unknown };
    return {
      percent: typeof value.percent === 'number' ? value.percent : DEFAULT_BONUS_PERCENT,
      windowDays: typeof value.window_days === 'number' ? value.window_days : DEFAULT_WINDOW_DAYS,
    };
  }

  private isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
