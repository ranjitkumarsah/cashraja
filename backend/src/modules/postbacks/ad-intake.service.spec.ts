import { AdNetwork } from '@prisma/client';
import { AppConfigService } from '../../common/app-config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VerifiedAdReward } from '../../providers/ad-ssv/ad-ssv-adapter';
import { AdIntakeService } from './ad-intake.service';
import { FakePhaseBPrisma, FakePostbackQueue } from './testing/fake-phase-b-prisma';

function reward(partial: Partial<VerifiedAdReward> = {}): VerifiedAdReward {
  return {
    networkUserId: 'not-set',
    externalTxnId: `ad-${Math.random().toString(36).slice(2)}`,
    adUnitId: 'mock-rewarded',
    raw: {},
    ...partial,
  };
}

describe('AdIntakeService', () => {
  let prisma: FakePhaseBPrisma;
  let queue: FakePostbackQueue;
  let service: AdIntakeService;
  let userId: string;

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    queue = new FakePostbackQueue();
    const appConfig = new AppConfigService(prisma as unknown as PrismaService);
    service = new AdIntakeService(
      prisma as unknown as PrismaService,
      appConfig,
      queue,
    );
    userId = prisma.addUser();
  });

  it('records a verified impression with the SERVER-side config amount and enqueues', async () => {
    prisma.setConfig('ads.coins_per_rewarded_view', { coins: 8 });
    const result = await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: userId, externalTxnId: 'ad-1' }),
    );

    expect(result.status).toBe('accepted');
    expect(prisma.impressions).toHaveLength(1);
    const row = prisma.impressions[0];
    expect(row).toMatchObject({ userId, coinReward: 8, verified: true });
    expect(row.ssvPayload).toMatchObject({ external_txn_id: 'ad-1' });
    expect(queue.jobs).toEqual([{ kind: 'ad', impressionId: row.id }]);
  });

  it('defaults to 5 coins per view when config is absent', async () => {
    await service.intakeAdReward(AdNetwork.mock, reward({ networkUserId: userId }));
    expect(prisma.impressions[0].coinReward).toBe(5);
  });

  it('honors an SSV-supplied reward within the configured max', async () => {
    await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: userId, rewardAmount: 12 }),
    );
    expect(prisma.impressions[0].coinReward).toBe(12);
  });

  it('rejects an SSV-supplied reward above ads.max_reward_per_view (recorded uncredited)', async () => {
    prisma.setConfig('ads.max_reward_per_view', { coins: 10 });
    const result = await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: userId, rewardAmount: 11 }),
    );
    expect(result).toEqual({ status: 'rejected', reason: 'reward_exceeds_max' });
    expect(prisma.impressions[0].coinReward).toBe(0); // recorded, not credited
    expect(queue.jobs).toHaveLength(0);
  });

  describe('daily cap (config ads.daily_reward_cap, default 20)', () => {
    beforeEach(() => {
      prisma.setConfig('ads.daily_reward_cap', { views: 3 });
    });

    function seedCreditedToday(count: number): void {
      for (let i = 0; i < count; i += 1) {
        prisma.addImpression({ userId, coinReward: 5, verified: true });
      }
    }

    it('below cap: credits', async () => {
      seedCreditedToday(2);
      const result = await service.intakeAdReward(
        AdNetwork.mock,
        reward({ networkUserId: userId }),
      );
      expect(result.status).toBe('accepted');
      expect(queue.jobs).toHaveLength(1);
    });

    it('at cap: impression recorded, NO credit', async () => {
      seedCreditedToday(3);
      const result = await service.intakeAdReward(
        AdNetwork.mock,
        reward({ networkUserId: userId }),
      );
      expect(result.status).toBe('capped');
      const last = prisma.impressions[prisma.impressions.length - 1];
      expect(last).toMatchObject({ coinReward: 0, verified: true });
      expect(queue.jobs).toHaveLength(0);
    });

    it('above cap: still capped', async () => {
      seedCreditedToday(5);
      const result = await service.intakeAdReward(
        AdNetwork.mock,
        reward({ networkUserId: userId }),
      );
      expect(result.status).toBe('capped');
    });

    it('capped (coin_reward=0) impressions do not consume the cap; yesterday resets it', async () => {
      seedCreditedToday(2);
      prisma.addImpression({ userId, coinReward: 0, verified: true }); // capped row
      prisma.addImpression({
        userId,
        coinReward: 5,
        verified: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      });
      const result = await service.intakeAdReward(
        AdNetwork.mock,
        reward({ networkUserId: userId }),
      );
      expect(result.status).toBe('accepted'); // 2 credited today < cap 3
    });
  });

  it('deduplicates on the network txn id (re-enqueueing creditable duplicates)', async () => {
    await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: userId, externalTxnId: 'ad-dup' }),
    );
    queue.jobs = [];

    const replay = await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: userId, externalTxnId: 'ad-dup' }),
    );
    expect(replay).toEqual({ status: 'duplicate' });
    expect(prisma.impressions).toHaveLength(1);
    expect(queue.jobs).toHaveLength(1); // pending credit self-heal
  });

  it('rejects unknown users', async () => {
    const result = await service.intakeAdReward(
      AdNetwork.mock,
      reward({ networkUserId: 'not-a-uuid' }),
    );
    expect(result).toEqual({ status: 'rejected', reason: 'unknown_user' });
    expect(prisma.impressions).toHaveLength(0);
  });
});
