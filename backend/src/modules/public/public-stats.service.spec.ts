import { RedemptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PublicStatsService } from './public-stats.service';

interface FakeUser {
  lastSeenAt: Date;
}
interface FakeRedemption {
  giftCardId: string;
  status: RedemptionStatus;
}
interface FakeGiftCard {
  id: string;
  denomination: number;
}

/** Minimal fake exercising exactly the reads PublicStatsService.compute() issues. */
class FakePublicPrisma {
  users: FakeUser[] = [];
  redemptions: FakeRedemption[] = [];
  giftCards: FakeGiftCard[] = [];
  groupByCalls = 0;

  readonly user = {
    count: (args?: { where?: { lastSeenAt: { gte: Date } } }) =>
      Promise.resolve(
        args?.where
          ? this.users.filter((u) => u.lastSeenAt >= args.where!.lastSeenAt.gte).length
          : this.users.length,
      ),
  };

  readonly redemption = {
    groupBy: (args: { where: { status: RedemptionStatus } }) => {
      this.groupByCalls += 1;
      const rows = this.redemptions.filter((r) => r.status === args.where.status);
      const byCard = new Map<string, number>();
      for (const r of rows) byCard.set(r.giftCardId, (byCard.get(r.giftCardId) ?? 0) + 1);
      return Promise.resolve(
        [...byCard.entries()].map(([giftCardId, n]) => ({
          giftCardId,
          _count: { _all: n },
        })),
      );
    },
  };

  readonly giftCard = {
    findMany: (args: { where: { id: { in: string[] } } }) =>
      Promise.resolve(
        this.giftCards.filter((c) => args.where.id.in.includes(c.id)),
      ),
  };
}

function makeService(prisma: FakePublicPrisma): PublicStatsService {
  return new PublicStatsService(prisma as unknown as PrismaService);
}

describe('PublicStatsService', () => {
  const now = new Date('2026-07-27T12:00:00.000Z');

  it('returns aggregate-only counts and rupee total (no PII)', async () => {
    const prisma = new FakePublicPrisma();
    prisma.users = [
      { lastSeenAt: now }, // active
      { lastSeenAt: new Date(now.getTime() - 60 * 60 * 1000) }, // active (1h ago)
      { lastSeenAt: new Date(now.getTime() - 48 * 60 * 60 * 1000) }, // inactive
    ];
    prisma.giftCards = [
      { id: 'gc-50', denomination: 50 },
      { id: 'gc-100', denomination: 100 },
    ];
    prisma.redemptions = [
      { giftCardId: 'gc-50', status: RedemptionStatus.issued },
      { giftCardId: 'gc-50', status: RedemptionStatus.issued },
      { giftCardId: 'gc-100', status: RedemptionStatus.issued },
      { giftCardId: 'gc-100', status: RedemptionStatus.requested }, // not issued → excluded
    ];

    const stats = await makeService(prisma).getStats(now);

    expect(stats).toEqual({
      total_users: 3,
      daily_active_users: 2,
      rewards_paid_rupees: 50 * 2 + 100 * 1, // 200
    });
    // Sanity: nothing name/email-shaped leaks into the payload.
    expect(Object.keys(stats)).toEqual([
      'total_users',
      'daily_active_users',
      'rewards_paid_rupees',
    ]);
  });

  it('reports zero rewards paid when nothing has been issued', async () => {
    const prisma = new FakePublicPrisma();
    prisma.users = [{ lastSeenAt: now }];
    const stats = await makeService(prisma).getStats(now);
    expect(stats.rewards_paid_rupees).toBe(0);
    expect(stats.total_users).toBe(1);
  });

  it('caches for 60s (a second call within the window hits no fresh groupBy)', async () => {
    const prisma = new FakePublicPrisma();
    prisma.users = [{ lastSeenAt: now }];
    const service = makeService(prisma);

    await service.getStats(now);
    await service.getStats(new Date(now.getTime() + 30 * 1000)); // within TTL
    expect(prisma.groupByCalls).toBe(1);

    await service.getStats(new Date(now.getTime() + 61 * 1000)); // past TTL
    expect(prisma.groupByCalls).toBe(2);
  });
});
