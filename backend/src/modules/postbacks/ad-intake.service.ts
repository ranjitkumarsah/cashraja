import { Inject, Injectable, Logger } from '@nestjs/common';
import { AdNetwork, Prisma } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VerifiedAdReward } from '../../providers/ad-ssv/ad-ssv-adapter';
import { POSTBACK_QUEUE, PostbackQueue } from './postback-queue';

export type AdIntakeResult =
  | { status: 'accepted'; impression_id: string }
  | { status: 'capped'; impression_id: string }
  | { status: 'duplicate' }
  | { status: 'rejected'; reason: string };

/** Admin-tunable ad-reward settings (app_config keys + defaults). */
export const AD_CONFIG = {
  /** Max rewarded views credited per user per UTC day. */
  dailyRewardCap: { key: 'ads.daily_reward_cap', field: 'views', fallback: 20 },
  /** Server-side coins per rewarded view (client/network amounts are NOT trusted). */
  coinsPerView: { key: 'ads.coins_per_rewarded_view', field: 'coins', fallback: 5 },
  /** Upper bound on an SSV-payload-supplied reward; above ⇒ rejected. */
  maxRewardPerView: { key: 'ads.max_reward_per_view', field: 'coins', fallback: 100 },
} as const;

/**
 * Ad SSV intake (TRD §3.6): the verified callback becomes an ad_impressions
 * row (verified=true, ssv_payload stored). The coin amount is decided
 * SERVER-SIDE from config — an SSV-supplied amount is honored only within the
 * configured max. Beyond the daily cap the impression is still recorded
 * (verified, coin_reward=0) but never credited.
 */
@Injectable()
export class AdIntakeService {
  private readonly logger = new Logger(AdIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    @Inject(POSTBACK_QUEUE) private readonly queue: PostbackQueue,
  ) {}

  async intakeAdReward(dbNetwork: AdNetwork, reward: VerifiedAdReward): Promise<AdIntakeResult> {
    const user = await this.findUser(reward.networkUserId);
    if (!user) {
      this.logger.warn(
        `[ads:${dbNetwork}] SSV for unknown user "${reward.networkUserId}" (txn ${reward.externalTxnId}) — rejected`,
      );
      return { status: 'rejected', reason: 'unknown_user' };
    }

    // Dedupe on the network transaction id carried inside ssv_payload; the
    // ledger idempotency key is the hard guarantee, this avoids junk rows.
    const existing = await this.prisma.adImpression.findFirst({
      where: {
        network: dbNetwork,
        ssvPayload: { path: ['external_txn_id'], equals: reward.externalTxnId },
      },
      select: { id: true, coinReward: true },
    });
    if (existing) {
      if (existing.coinReward > 0) {
        await this.queue.enqueue({ kind: 'ad', impressionId: existing.id }); // self-heal lost jobs
      }
      return { status: 'duplicate' };
    }

    const [cap, coinsPerView, maxPerView] = await Promise.all([
      this.configNumber(AD_CONFIG.dailyRewardCap),
      this.configNumber(AD_CONFIG.coinsPerView),
      this.configNumber(AD_CONFIG.maxRewardPerView),
    ]);

    if (reward.rewardAmount !== undefined && reward.rewardAmount > maxPerView) {
      await this.createImpression(user.id, dbNetwork, reward, 0);
      this.logger.warn(
        `[ads:${dbNetwork}] SSV reward ${reward.rewardAmount} exceeds max ${maxPerView} — recorded uncredited`,
      );
      return { status: 'rejected', reason: 'reward_exceeds_max' };
    }
    const coins = reward.rewardAmount ?? coinsPerView;

    const creditedToday = await this.countCreditedToday(user.id);
    if (creditedToday >= cap) {
      const impression = await this.createImpression(user.id, dbNetwork, reward, 0);
      return { status: 'capped', impression_id: impression.id };
    }

    const impression = await this.createImpression(user.id, dbNetwork, reward, coins);
    await this.queue.enqueue({ kind: 'ad', impressionId: impression.id });
    return { status: 'accepted', impression_id: impression.id };
  }

  private async createImpression(
    userId: string,
    network: AdNetwork,
    reward: VerifiedAdReward,
    coinReward: number,
  ): Promise<{ id: string }> {
    return this.prisma.adImpression.create({
      data: {
        userId,
        network,
        adUnitId: reward.adUnitId,
        coinReward,
        verified: true,
        ssvPayload: {
          external_txn_id: reward.externalTxnId,
          ...reward.raw,
        },
      },
      select: { id: true },
    });
  }

  /** Rewarded views already credited (or queued to credit) today, UTC. */
  private async countCreditedToday(userId: string): Promise<number> {
    const now = new Date();
    const dayStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    return this.prisma.adImpression.count({
      where: {
        userId,
        verified: true,
        coinReward: { gt: 0 },
        createdAt: { gte: dayStartUtc },
      },
    });
  }

  private async findUser(userId: string): Promise<{ id: string } | null> {
    try {
      return await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) return null;
      throw err;
    }
  }

  private configNumber(spec: { key: string; field: string; fallback: number }): Promise<number> {
    return this.appConfig.getNumber(spec.key, spec.field, spec.fallback);
  }
}
