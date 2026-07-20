import { RedemptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MetricsService } from './metrics.service';

interface FakeUser {
  lastSeenAt: Date;
}
interface FakeLedger {
  amount: number;
}
interface FakeRedemption {
  status: RedemptionStatus;
  coinAmount: number;
}
interface FakeCompletion {
  status: string;
}

/** Minimal fake exercising exactly the reads MetricsService.compute() issues. */
class FakeMetricsPrisma {
  users: FakeUser[] = [];
  ledger: FakeLedger[] = [];
  redemptions: FakeRedemption[] = [];
  completions: FakeCompletion[] = [];

  readonly user = {
    count: (args: { where: { lastSeenAt: { gte: Date } } }) =>
      Promise.resolve(this.users.filter((u) => u.lastSeenAt >= args.where.lastSeenAt.gte).length),
  };
  readonly coinLedger = {
    aggregate: (args: { where: { amount: { gt: number } } }) => {
      const rows = this.ledger.filter((l) => l.amount > args.where.amount.gt);
      const sum = rows.length ? rows.reduce((a, l) => a + l.amount, 0) : null;
      return Promise.resolve({ _sum: { amount: sum } });
    },
  };
  readonly redemption = {
    aggregate: (args: { where: { status: RedemptionStatus | { in: RedemptionStatus[] } } }) => {
      const match = (r: FakeRedemption): boolean =>
        typeof args.where.status === 'object'
          ? args.where.status.in.includes(r.status)
          : r.status === args.where.status;
      const rows = this.redemptions.filter(match);
      const sum = rows.length ? rows.reduce((a, r) => a + r.coinAmount, 0) : null;
      return Promise.resolve({ _sum: { coinAmount: sum } });
    },
  };
  readonly offerCompletion = {
    count: (args?: { where?: { status: string } }) =>
      Promise.resolve(
        args?.where ? this.completions.filter((c) => c.status === args.where!.status).length : this.completions.length,
      ),
  };
}

function build(): { prisma: FakeMetricsPrisma; service: MetricsService } {
  const prisma = new FakeMetricsPrisma();
  const service = new MetricsService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe('MetricsService.compute', () => {
  it('computes DAU, issued/redeemed coins, completion rate and outstanding liability', async () => {
    const { prisma, service } = build();
    const now = new Date('2026-07-20T12:00:00Z');
    // DAU: 2 active within 24h, 1 stale
    prisma.users = [
      { lastSeenAt: new Date('2026-07-20T06:00:00Z') },
      { lastSeenAt: new Date('2026-07-19T13:00:00Z') },
      { lastSeenAt: new Date('2026-07-18T00:00:00Z') },
    ];
    // coins issued = sum of positive rows only (debits excluded)
    prisma.ledger = [{ amount: 100 }, { amount: 50 }, { amount: -30 }];
    // redeemed = issued redemptions; outstanding = requested/under_review/approved
    prisma.redemptions = [
      { status: RedemptionStatus.issued, coinAmount: 5000 },
      { status: RedemptionStatus.issued, coinAmount: 1000 },
      { status: RedemptionStatus.requested, coinAmount: 2500 },
      { status: RedemptionStatus.approved, coinAmount: 500 },
      { status: RedemptionStatus.rejected, coinAmount: 9999 }, // excluded from both
    ];
    // completion rate = credited / total = 3/4
    prisma.completions = [
      { status: 'credited' },
      { status: 'credited' },
      { status: 'credited' },
      { status: 'pending' },
    ];

    const m = await service.compute(now);
    expect(m.dau).toBe(2);
    expect(m.coins_issued).toBe(150);
    expect(m.coins_redeemed).toBe(6000);
    expect(m.outstanding_liability).toBe(3000);
    expect(m.offer_completion_rate).toBeCloseTo(0.75, 5);
  });

  it('handles the empty system without dividing by zero', async () => {
    const { service } = build();
    const m = await service.compute();
    expect(m).toEqual({
      dau: 0,
      coins_issued: 0,
      coins_redeemed: 0,
      offer_completion_rate: 0,
      outstanding_liability: 0,
    });
  });
});
