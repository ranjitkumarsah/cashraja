import { randomUUID } from 'node:crypto';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FakeEngagementLedger, RecordingFraudSignal } from '../../common/testing/engagement-fakes';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from './referral.service';

interface FakeReferral {
  id: string;
  referrerId: string;
  referredId: string;
  bonusPercent: Prisma.Decimal;
  validUntil: Date;
}

interface FakeReferralEarning {
  id: string;
  referralId: string;
  sourceLedgerId: string;
  bonusLedgerId: string;
}

interface FakeUserRow {
  id: string;
  status: UserStatus;
  referralCode: string;
  ledger: Array<{ amount: number; sourceType: string }>;
}

function P2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'fake',
  });
}

class FakeReferralPrisma {
  referrals: FakeReferral[] = [];
  earnings: FakeReferralEarning[] = [];
  users = new Map<string, FakeUserRow>();

  addUser(status: UserStatus = UserStatus.active): FakeUserRow {
    const row: FakeUserRow = {
      id: randomUUID(),
      status,
      referralCode: `CODE${randomUUID().slice(0, 6).toUpperCase()}`,
      ledger: [],
    };
    this.users.set(row.id, row);
    return row;
  }

  addReferral(referrerId: string, referredId: string, percent: number, validUntil: Date): FakeReferral {
    const row: FakeReferral = {
      id: randomUUID(),
      referrerId,
      referredId,
      bonusPercent: new Prisma.Decimal(percent),
      validUntil,
    };
    this.referrals.push(row);
    return row;
  }

  readonly referral = {
    findUnique: (args: { where: { referredId: string } }) =>
      Promise.resolve(this.referrals.find((r) => r.referredId === args.where.referredId) ?? null),
    count: (args: { where: { referrerId: string; validUntil?: { gt: Date } } }) =>
      Promise.resolve(
        this.referrals.filter(
          (r) =>
            r.referrerId === args.where.referrerId &&
            (!args.where.validUntil || r.validUntil > args.where.validUntil.gt),
        ).length,
      ),
  };

  readonly referralEarning = {
    findUnique: (args: { where: { sourceLedgerId: string } }) =>
      Promise.resolve(
        this.earnings.find((e) => e.sourceLedgerId === args.where.sourceLedgerId) ?? null,
      ),
    create: (args: { data: Omit<FakeReferralEarning, 'id'> }) => {
      if (this.earnings.some((e) => e.sourceLedgerId === args.data.sourceLedgerId)) throw P2002();
      if (this.earnings.some((e) => e.bonusLedgerId === args.data.bonusLedgerId)) throw P2002();
      const row: FakeReferralEarning = { id: randomUUID(), ...args.data };
      this.earnings.push(row);
      return Promise.resolve({ ...row });
    },
  };

  readonly user = {
    findUnique: (args: { where: { id: string }; select?: Record<string, boolean> }) => {
      const row = this.users.get(args.where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
  };

  readonly coinLedger = {
    aggregate: (args: { where: { userId: string; sourceType: string }; _sum: unknown }) => {
      const row = this.users.get(args.where.userId);
      const sum = row
        ? row.ledger
            .filter((l) => l.sourceType === args.where.sourceType)
            .reduce((acc, l) => acc + l.amount, 0)
        : 0;
      return Promise.resolve({ _sum: { amount: sum === 0 ? null : sum } });
    },
  };
}

const YEAR_AHEAD = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 1000);

describe('ReferralService', () => {
  let prisma: FakeReferralPrisma;
  let ledger: FakeEngagementLedger;
  let fraud: RecordingFraudSignal;
  let service: ReferralService;

  beforeEach(() => {
    prisma = new FakeReferralPrisma();
    ledger = new FakeEngagementLedger();
    fraud = new RecordingFraudSignal();
    service = new ReferralService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      fraud,
    );
  });

  it('credits the referrer the snapshot percent of a referred user’s earning', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-1' });

    expect(ledger.calls).toHaveLength(1);
    expect(ledger.calls[0]).toMatchObject({
      userId: referrer.id,
      amount: 10, // 10% of 100
      sourceType: 'referral',
      idempotencyKey: 'referral:src-1',
    });
    expect(prisma.earnings).toHaveLength(1);
    expect(prisma.earnings[0]).toMatchObject({ sourceLedgerId: 'src-1' });
  });

  it('uses the snapshot percent from the referral row, not any current default', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 25, YEAR_AHEAD); // snapshot 25%

    await service.onUserEarned({ userId: referred.id, amount: 200, sourceLedgerId: 'src-2' });
    expect(ledger.calls[0].amount).toBe(50); // 25% of 200
  });

  it('does not pay out after the referral window closes', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, PAST); // expired

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-3' });
    expect(ledger.calls).toHaveLength(0);
    expect(prisma.earnings).toHaveLength(0);
  });

  it('skips payout and signals when the referred user is flagged', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser(UserStatus.flagged);
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-4' });
    expect(ledger.calls).toHaveLength(0);
    expect(fraud.signals[0]).toMatchObject({ rule: 'self_referral' });
  });

  it('skips payout when the referrer is banned', async () => {
    const referrer = prisma.addUser(UserStatus.banned);
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-5' });
    expect(ledger.calls).toHaveLength(0);
  });

  it('skips a self-referral and fires the fraud signal', async () => {
    const self = prisma.addUser();
    prisma.addReferral(self.id, self.id, 10, YEAR_AHEAD); // referrer === referred

    await service.onUserEarned({ userId: self.id, amount: 100, sourceLedgerId: 'src-6' });
    expect(ledger.calls).toHaveLength(0);
    expect(fraud.signals[0]).toMatchObject({ rule: 'self_referral' });
  });

  it('is idempotent: the same source earning never double-pays', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-7' });
    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-7' });

    expect(ledger.calls).toHaveLength(1);
    expect(prisma.earnings).toHaveLength(1);
  });

  it('does not fan out on a non-positive amount', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 0, sourceLedgerId: 'src-8' });
    await service.onUserEarned({ userId: referred.id, amount: -50, sourceLedgerId: 'src-9' });
    expect(ledger.calls).toHaveLength(0);
  });

  it('does nothing for a user who was never referred', async () => {
    const orphan = prisma.addUser();
    await service.onUserEarned({ userId: orphan.id, amount: 100, sourceLedgerId: 'src-10' });
    expect(ledger.calls).toHaveLength(0);
  });

  it('floors fractional bonuses (no partial coins)', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);

    await service.onUserEarned({ userId: referred.id, amount: 15, sourceLedgerId: 'src-11' });
    expect(ledger.calls[0].amount).toBe(1); // floor(1.5)
  });

  it('my-code returns the caller’s referral code', async () => {
    const user = prisma.addUser();
    const view = await service.myCode(user.id);
    expect(view.code).toBe(user.referralCode);
  });

  it('stats reports referred count, active referrals and total earned', async () => {
    const referrer = prisma.addUser();
    referrer.ledger.push({ amount: 10, sourceType: 'referral' });
    referrer.ledger.push({ amount: 5, sourceType: 'referral' });
    referrer.ledger.push({ amount: 999, sourceType: 'game' }); // ignored
    prisma.addReferral(referrer.id, prisma.addUser().id, 10, YEAR_AHEAD); // active
    prisma.addReferral(referrer.id, prisma.addUser().id, 10, PAST); // inactive

    const stats = await service.stats(referrer.id);
    expect(stats).toMatchObject({
      code: referrer.referralCode,
      referred_count: 2,
      active_referrals: 1,
      total_earned_from_referrals: 15,
    });
  });
});
