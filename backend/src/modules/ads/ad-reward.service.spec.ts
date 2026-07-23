import { randomUUID } from 'node:crypto';
import { LedgerSourceType } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import {
  FakeAppConfig,
  FakeEngagementLedger,
  RecordingNotificationHook,
  RecordingReferral,
} from '../../common/testing/engagement-fakes';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import { AdRewardService } from './ad-reward.service';

interface FakeCredit {
  userId: string;
  sourceType: LedgerSourceType;
  amount: number;
  createdAt: Date;
}

/** Minimal in-memory prisma surface used by AdRewardService. */
class FakeAdPrisma {
  credits: FakeCredit[] = [];
  impressions: Array<{ id: string; userId: string; coinReward: number; verified: boolean }> = [];

  readonly adImpression = {
    create: (args: {
      data: { userId: string; coinReward: number; verified: boolean };
    }): Promise<{ id: string }> => {
      const row = { id: randomUUID(), ...args.data };
      this.impressions.push(row);
      return Promise.resolve({ id: row.id });
    },
  };

  readonly coinLedger = {
    count: (args: {
      where: { userId: string; createdAt: { gte: Date } };
    }): Promise<number> =>
      Promise.resolve(
        this.credits.filter(
          (c) => c.userId === args.where.userId && c.createdAt >= args.where.createdAt.gte,
        ).length,
      ),
    findFirst: (args: { where: { userId: string } }): Promise<{ createdAt: Date } | null> => {
      const rows = this.credits
        .filter((c) => c.userId === args.where.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return Promise.resolve(rows[0] ? { createdAt: rows[0].createdAt } : null);
    },
  };
}

describe('AdRewardService', () => {
  let prisma: FakeAdPrisma;
  let ledger: FakeEngagementLedger;
  let config: FakeAppConfig;
  let referral: RecordingReferral;
  let notifications: RecordingNotificationHook;
  let service: AdRewardService;
  const userId = randomUUID();

  beforeEach(() => {
    prisma = new FakeAdPrisma();
    ledger = new FakeEngagementLedger();
    config = new FakeAppConfig()
      .set('ads.daily_reward_cap', { views: 10 })
      .set('ads.coins_per_rewarded_view', { coins: 5 })
      .set('ads.reward_cooldown_seconds', { seconds: 60 });
    referral = new RecordingReferral();
    notifications = new RecordingNotificationHook();
    service = new AdRewardService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      config as unknown as AppConfigService,
      referral as unknown as ReferralService,
      notifications,
    );
    // Mirror ledger credits into the fake prisma so cap/cooldown queries see them.
    const original = ledger.record.bind(ledger);
    ledger.record = async (params) => {
      const result = await original(params);
      if (!result.duplicate && params.sourceType === LedgerSourceType.ad) {
        prisma.credits.push({
          userId: params.userId,
          sourceType: LedgerSourceType.ad,
          amount: params.amount,
          createdAt: new Date(),
        });
      }
      return result;
    };
  });

  it('credits server-side coins on a client-gated reward and fires fan-out', async () => {
    const result = await service.claimReward(userId);
    expect(result.coins_earned).toBe(5);
    expect(result.new_balance).toBe(5);
    expect(result.rewards_remaining_today).toBe(9);
    expect(ledger.calls[0].sourceType).toBe(LedgerSourceType.ad);
    expect(prisma.impressions).toHaveLength(1);
    expect(prisma.impressions[0].verified).toBe(false);
    expect(referral.calls).toHaveLength(1);
    expect(notifications.credited[0]).toMatchObject({ userId, coins: 5, sourceType: 'ad' });
  });

  it('enforces the cooldown between consecutive claims (429)', async () => {
    await service.claimReward(userId);
    await expect(service.claimReward(userId)).rejects.toMatchObject({ status: 429 });
    expect(ledger.calls).toHaveLength(1); // only the first credited
  });

  it('allows another claim once the cooldown has elapsed', async () => {
    await service.claimReward(userId);
    // Age the only credit past the 60s cooldown.
    prisma.credits[0].createdAt = new Date(Date.now() - 61_000);
    const second = await service.claimReward(userId);
    expect(second.coins_earned).toBe(5);
    expect(ledger.calls).toHaveLength(2);
  });

  it('enforces the daily cap (429) even with cooldown cleared', async () => {
    // Seed 10 aged credits → at cap.
    for (let i = 0; i < 10; i++) {
      prisma.credits.push({
        userId,
        sourceType: LedgerSourceType.ad,
        amount: 5,
        createdAt: new Date(Date.now() - 3_600_000),
      });
    }
    await expect(service.claimReward(userId)).rejects.toMatchObject({ status: 429 });
    expect(ledger.calls).toHaveLength(0);
  });

  it('reports remaining count and cooldown in state', async () => {
    await service.claimReward(userId);
    const state = await service.getState(userId);
    expect(state.daily_cap).toBe(10);
    expect(state.rewards_remaining_today).toBe(9);
    expect(state.cooldown_seconds).toBe(60);
    expect(state.cooldown_remaining_seconds).toBeGreaterThan(0);
    expect(state.coins_per_view).toBe(5);
  });
});
