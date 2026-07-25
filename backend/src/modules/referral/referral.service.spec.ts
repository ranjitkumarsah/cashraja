import { randomUUID } from 'node:crypto';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FakeEngagementLedger,
  RecordingFraudSignal,
  RecordingNotificationHook,
} from '../../common/testing/engagement-fakes';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from './referral.service';

interface FakeReferral {
  id: string;
  referrerId: string;
  referredId: string;
  bonusPercent: Prisma.Decimal;
  validUntil: Date;
  createdAt: Date;
}

interface FakeCoinRow {
  id: string;
  userId: string;
  amount: number;
  sourceType: string;
  createdAt: Date;
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
  displayName: string;
  createdAt: Date;
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
  devices: Array<{ userId: string; deviceFingerprint: string }> = [];
  coinRows: FakeCoinRow[] = [];
  appConfigRow: { value: unknown } | null = null;

  linkDevice(userId: string, deviceFingerprint: string): void {
    this.devices.push({ userId, deviceFingerprint });
  }

  addUser(status: UserStatus = UserStatus.active): FakeUserRow {
    const row: FakeUserRow = {
      id: randomUUID(),
      status,
      referralCode: `CODE${randomUUID().slice(0, 6).toUpperCase()}`,
      displayName: 'Test User',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      ledger: [],
    };
    this.users.set(row.id, row);
    return row;
  }

  addReferral(
    referrerId: string,
    referredId: string,
    percent: number,
    validUntil: Date,
    createdAt: Date = new Date(Date.now() - 60 * 60 * 1000),
  ): FakeReferral {
    const row: FakeReferral = {
      id: randomUUID(),
      referrerId,
      referredId,
      bonusPercent: new Prisma.Decimal(percent),
      validUntil,
      createdAt,
    };
    this.referrals.push(row);
    return row;
  }

  /** Seed a referral bonus credit (referrer's earning) linked to a referral. */
  addEarning(referralId: string, bonusAmount: number): FakeReferralEarning {
    const bonusLedgerId = randomUUID();
    this.coinRows.push({
      id: bonusLedgerId,
      userId: '',
      amount: bonusAmount,
      sourceType: 'referral',
      createdAt: new Date(),
    });
    const row: FakeReferralEarning = {
      id: randomUUID(),
      referralId,
      sourceLedgerId: randomUUID(),
      bonusLedgerId,
    };
    this.earnings.push(row);
    return row;
  }

  /** Seed a positive ledger credit for a referred user (used by breakdown). */
  addCoinCredit(userId: string, amount: number, createdAt: Date): void {
    this.coinRows.push({ id: randomUUID(), userId, amount, sourceType: 'offer', createdAt });
  }

  setReferralConfig(percent: number, windowDays: number): void {
    this.appConfigRow = { value: { percent, window_days: windowDays } };
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
    findMany: (args: { where: { referrerId: string } }) =>
      Promise.resolve(
        this.referrals
          .filter((r) => r.referrerId === args.where.referrerId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => {
            const referred = this.users.get(r.referredId);
            return {
              ...r,
              referred: {
                displayName: referred?.displayName ?? 'Unknown',
                createdAt: referred?.createdAt ?? new Date(0),
              },
              earnings: this.earnings
                .filter((e) => e.referralId === r.id)
                .map((e) => ({
                  ...e,
                  bonusLedger: {
                    amount: this.coinRows.find((c) => c.id === e.bonusLedgerId)?.amount ?? 0,
                  },
                })),
            };
          }),
      ),
  };

  readonly appConfig = {
    findFirst: () => Promise.resolve(this.appConfigRow),
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

  readonly device = {
    findMany: (args: { where: { userId: string }; select?: Record<string, boolean> }) =>
      Promise.resolve(
        this.devices
          .filter((d) => d.userId === args.where.userId)
          .map((d) => ({ deviceFingerprint: d.deviceFingerprint })),
      ),
  };

  readonly coinLedger = {
    aggregate: (args: {
      where: {
        userId: string;
        sourceType?: string;
        amount?: { gt: number };
        createdAt?: { gte: Date; lte: Date };
      };
      _sum: unknown;
    }) => {
      const w = args.where;
      // stats path: sum by sourceType over the user's in-memory ledger
      if (w.sourceType !== undefined) {
        const row = this.users.get(w.userId);
        const sum = row
          ? row.ledger
              .filter((l) => l.sourceType === w.sourceType)
              .reduce((acc, l) => acc + l.amount, 0)
          : 0;
        return Promise.resolve({ _sum: { amount: sum === 0 ? null : sum } });
      }
      // breakdown path: positive credits inside a window
      const sum = this.coinRows
        .filter(
          (c) =>
            c.userId === w.userId &&
            (w.amount === undefined || c.amount > w.amount.gt) &&
            (w.createdAt === undefined ||
              (c.createdAt >= w.createdAt.gte && c.createdAt <= w.createdAt.lte)),
        )
        .reduce((acc, c) => acc + c.amount, 0);
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
  let notifications: RecordingNotificationHook;
  let service: ReferralService;

  beforeEach(() => {
    prisma = new FakeReferralPrisma();
    ledger = new FakeEngagementLedger();
    fraud = new RecordingFraudSignal();
    notifications = new RecordingNotificationHook();
    service = new ReferralService(
      prisma as unknown as PrismaService,
      ledger as unknown as LedgerService,
      fraud,
      notifications,
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
    // referrer is notified of their bonus credit
    expect(notifications.credited).toHaveLength(1);
    expect(notifications.credited[0]).toMatchObject({
      userId: referrer.id,
      coins: 10,
      sourceType: 'referral',
    });
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

  it('blocks the bonus and signals self-referral when referrer and referred share a device', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);
    // Both accounts fingerprinted to the same physical device.
    prisma.linkDevice(referrer.id, 'device-abc');
    prisma.linkDevice(referred.id, 'device-abc');

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-dev' });

    expect(ledger.calls).toHaveLength(0);
    expect(prisma.earnings).toHaveLength(0);
    expect(fraud.signals[0]).toMatchObject({
      rule: 'self_referral',
      details: { sharedDevice: true, referrerId: referrer.id },
    });
  });

  it('pays out normally when referrer and referred are on different devices', async () => {
    const referrer = prisma.addUser();
    const referred = prisma.addUser();
    prisma.addReferral(referrer.id, referred.id, 10, YEAR_AHEAD);
    prisma.linkDevice(referrer.id, 'device-1');
    prisma.linkDevice(referred.id, 'device-2');

    await service.onUserEarned({ userId: referred.id, amount: 100, sourceLedgerId: 'src-diff' });
    expect(ledger.calls).toHaveLength(1);
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

  describe('breakdown', () => {
    it('returns per-user detail with commission, in-window earnings and totals', async () => {
      const referrer = prisma.addUser();
      const alice = prisma.addUser();
      alice.displayName = 'Alice';
      const bob = prisma.addUser();
      bob.displayName = 'Bob';

      const now = Date.now();
      const refA = prisma.addReferral(referrer.id, alice.id, 10, new Date(now + 5 * 24 * 3600 * 1000));
      const refB = prisma.addReferral(referrer.id, bob.id, 10, new Date(now - 24 * 3600 * 1000)); // expired

      // Alice earned inside her window; referrer took two commission credits.
      prisma.addCoinCredit(alice.id, 100, new Date(now - 30 * 60 * 1000));
      prisma.addCoinCredit(alice.id, 50, new Date(now - 20 * 60 * 1000));
      prisma.addEarning(refA.id, 10);
      prisma.addEarning(refA.id, 5);
      // Bob earned but the referrer got one commission credit.
      prisma.addCoinCredit(bob.id, 200, new Date(now - 30 * 60 * 1000));
      prisma.addEarning(refB.id, 20);

      prisma.setReferralConfig(10, 30);

      const view = await service.breakdown(referrer.id);

      expect(view.config).toEqual({ bonus_percent: 10, window_days: 30 });
      expect(view.totals).toEqual({ referred_count: 2, active_count: 1, total_commission: 35 });
      expect(view.referred).toHaveLength(2);

      const aliceRow = view.referred.find((r) => r.display_name === 'Alice')!;
      expect(aliceRow.their_earnings_total).toBe(150);
      expect(aliceRow.commission_earned_by_me).toBe(15);
      expect(aliceRow.window_active).toBe(true);

      const bobRow = view.referred.find((r) => r.display_name === 'Bob')!;
      expect(bobRow.commission_earned_by_me).toBe(20);
      expect(bobRow.window_active).toBe(false);
    });

    it('falls back to default percent/window when app_config has no row', async () => {
      const referrer = prisma.addUser();
      const view = await service.breakdown(referrer.id);
      expect(view.config).toEqual({ bonus_percent: 10, window_days: 30 });
      expect(view.referred).toHaveLength(0);
      expect(view.totals).toEqual({ referred_count: 0, active_count: 0, total_commission: 0 });
    });
  });
});
