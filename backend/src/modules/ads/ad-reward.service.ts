import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { AdNetwork, LedgerSourceType } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';
import { ReferralService } from '../referral/referral.service';

/** Admin-tunable client-gated rewarded-ad settings (app_config keys + defaults). */
export const AD_REWARD_CONFIG = {
  /** Max rewarded views credited per user per UTC day (G7 — owner target 10). */
  dailyCap: { key: 'ads.daily_reward_cap', field: 'views', fallback: 10 },
  /** Server-side coins per rewarded view (client amounts are NEVER trusted). */
  coinsPerView: { key: 'ads.coins_per_rewarded_view', field: 'coins', fallback: 5 },
  /** Minimum seconds between two consecutive rewarded-ad claims (G7 cooldown). */
  cooldownSeconds: { key: 'ads.reward_cooldown_seconds', field: 'seconds', fallback: 60 },
} as const;

export interface AdRewardState {
  daily_cap: number;
  rewards_remaining_today: number;
  cooldown_seconds: number;
  cooldown_remaining_seconds: number;
  coins_per_view: number;
}

export interface AdRewardResult {
  coins_earned: number;
  new_balance: number;
  rewards_remaining_today: number;
  cooldown_seconds: number;
}

/**
 * Client-gated rewarded-ad credit (G7). The app shows a real rewarded ad and,
 * only on a verified in-SDK reward, calls this endpoint. The server stays
 * authoritative: the coin amount comes from config (never the client), a daily
 * cap and a per-user cooldown are enforced here, and the credit is a normal
 * append-only ledger row.
 *
 * Production hardening is the ad-network SSV path (already built in
 * PostbacksModule / AdIntakeService); this endpoint is the dev/launch flow the
 * owner tests against.
 */
@Injectable()
export class AdRewardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly appConfig: AppConfigService,
    private readonly referral: ReferralService,
    @Optional() @Inject(NOTIFICATION_HOOK) private readonly notifications?: NotificationHook,
  ) {}

  async getState(userId: string): Promise<AdRewardState> {
    const [cap, coinsPerView, cooldownSeconds] = await this.loadConfig();
    const creditedToday = await this.countCreditedToday(userId);
    const cooldownRemaining = await this.cooldownRemaining(userId, cooldownSeconds);
    return {
      daily_cap: cap,
      rewards_remaining_today: Math.max(0, cap - creditedToday),
      cooldown_seconds: cooldownSeconds,
      cooldown_remaining_seconds: cooldownRemaining,
      coins_per_view: coinsPerView,
    };
  }

  async claimReward(userId: string): Promise<AdRewardResult> {
    const [cap, coinsPerView, cooldownSeconds] = await this.loadConfig();

    const creditedToday = await this.countCreditedToday(userId);
    if (creditedToday >= cap) {
      throw new HttpException(
        { message: 'ad_daily_cap_reached', rewards_remaining_today: 0 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cooldownRemaining = await this.cooldownRemaining(userId, cooldownSeconds);
    if (cooldownRemaining > 0) {
      throw new HttpException(
        { message: 'ad_cooldown_active', cooldown_remaining_seconds: cooldownRemaining },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Audit row for the client-gated view (verified=false — no SSV proof here).
    const impression = await this.prisma.adImpression.create({
      data: {
        userId,
        network: AdNetwork.admob,
        adUnitId: 'client_rewarded',
        coinReward: coinsPerView,
        verified: false,
      },
      select: { id: true },
    });

    const credit = await this.ledger.record({
      userId,
      amount: coinsPerView,
      sourceType: LedgerSourceType.ad,
      sourceRefId: impression.id,
      idempotencyKey: `ad:${impression.id}`,
    });

    // Referral fan-out + credit notification (best-effort, idempotent).
    await this.referral.onUserEarned({
      userId,
      amount: coinsPerView,
      sourceLedgerId: credit.entry.id,
    });
    await this.notifications?.onCredited({
      userId,
      coins: coinsPerView,
      sourceType: LedgerSourceType.ad,
      sourceRefId: credit.entry.id,
    });

    return {
      coins_earned: coinsPerView,
      new_balance: credit.entry.balanceAfter,
      rewards_remaining_today: Math.max(0, cap - (creditedToday + 1)),
      cooldown_seconds: cooldownSeconds,
    };
  }

  private loadConfig(): Promise<[number, number, number]> {
    return Promise.all([
      this.configNumber(AD_REWARD_CONFIG.dailyCap),
      this.configNumber(AD_REWARD_CONFIG.coinsPerView),
      this.configNumber(AD_REWARD_CONFIG.cooldownSeconds),
    ]);
  }

  /** Rewarded-ad credits recorded today (UTC), matching the SSV cap window. */
  private async countCreditedToday(userId: string): Promise<number> {
    return this.prisma.coinLedger.count({
      where: {
        userId,
        sourceType: LedgerSourceType.ad,
        amount: { gt: 0 },
        createdAt: { gte: utcDayStart() },
      },
    });
  }

  /** Seconds still owed on the cooldown since the last ad credit (0 if clear). */
  private async cooldownRemaining(userId: string, cooldownSeconds: number): Promise<number> {
    if (cooldownSeconds <= 0) return 0;
    const last = await this.prisma.coinLedger.findFirst({
      where: { userId, sourceType: LedgerSourceType.ad, amount: { gt: 0 } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!last) return 0;
    const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
    return elapsed >= cooldownSeconds ? 0 : Math.ceil(cooldownSeconds - elapsed);
  }

  private configNumber(spec: { key: string; field: string; fallback: number }): Promise<number> {
    return this.appConfig.getNumber(spec.key, spec.field, spec.fallback);
  }
}

function utcDayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
