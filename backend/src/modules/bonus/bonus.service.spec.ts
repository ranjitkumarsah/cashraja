import { randomUUID } from 'node:crypto';
import { BonusKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FakeEngagementLedger,
  RecordingNotificationHook,
  RecordingReferral,
} from '../../common/testing/engagement-fakes';
import { LedgerService } from '../ledger/ledger.service';
import { ReferralService } from '../referral/referral.service';
import { cryptoRandomInt, PrizeEntry, RandomIntFn, rollWeighted } from './bonus-roll';
import { BonusService } from './bonus.service';

interface FakeAttempt {
  id: string;
  userId: string;
  kind: BonusKind;
  resultCoins: number;
  createdAt: Date;
}

class FakeBonusPrisma {
  attempts: FakeAttempt[] = [];
  configs: Array<{ kind: BonusKind; attemptsPerDay: number; weightedTable: unknown; version: number }> =
    [];

  setConfig(kind: BonusKind, attemptsPerDay: number, table: PrizeEntry[], version = 1): void {
    this.configs.push({ kind, attemptsPerDay, weightedTable: table, version });
  }

  readonly bonusConfig = {
    findFirst: (args: { where: { kind: BonusKind }; orderBy?: unknown; select?: unknown }) => {
      const rows = this.configs
        .filter((c) => c.kind === args.where.kind)
        .sort((a, b) => b.version - a.version);
      const row = rows[0];
      return Promise.resolve(
        row ? { attemptsPerDay: row.attemptsPerDay, weightedTable: row.weightedTable } : null,
      );
    },
  };

  readonly bonusAttempt = {
    create: (args: { data: { userId: string; kind: BonusKind; resultCoins: number } }) => {
      const row: FakeAttempt = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.attempts.push(row);
      return Promise.resolve({ ...row });
    },
    findUnique: (args: { where: { id: string } }) => {
      const row = this.attempts.find((a) => a.id === args.where.id);
      return Promise.resolve(row ? { ...row } : null);
    },
    count: (args: {
      where: { userId: string; kind: BonusKind; createdAt: { gte: Date } };
    }) =>
      Promise.resolve(
        this.attempts.filter(
          (a) =>
            a.userId === args.where.userId &&
            a.kind === args.where.kind &&
            a.createdAt >= args.where.createdAt.gte,
        ).length,
      ),
  };
}

const TABLE: PrizeEntry[] = [
  { coins: 0, weight: 30 },
  { coins: 2, weight: 35 },
  { coins: 5, weight: 20 },
  { coins: 20, weight: 10 },
  { coins: 100, weight: 5 },
];

function buildService(
  prisma: FakeBonusPrisma,
  ledger: FakeEngagementLedger,
  referral: RecordingReferral,
  rnd: RandomIntFn,
  notifications: RecordingNotificationHook = new RecordingNotificationHook(),
): BonusService {
  return new BonusService(
    prisma as unknown as PrismaService,
    ledger as unknown as LedgerService,
    referral as unknown as ReferralService,
    rnd,
    notifications,
  );
}

describe('BonusService', () => {
  let prisma: FakeBonusPrisma;
  let ledger: FakeEngagementLedger;
  let referral: RecordingReferral;
  const userId = randomUUID();

  beforeEach(() => {
    prisma = new FakeBonusPrisma();
    ledger = new FakeEngagementLedger();
    referral = new RecordingReferral();
    prisma.setConfig(BonusKind.scratch, 3, TABLE);
  });

  it('credits the rolled prize and reports remaining attempts', async () => {
    // rnd returns 65 → skips 0(30) and 2(35) cumulative 65, lands on 5(20).
    const notifications = new RecordingNotificationHook();
    const service = buildService(prisma, ledger, referral, () => 65, notifications);
    const result = await service.play(userId, BonusKind.scratch);
    expect(result.prize_coins).toBe(5);
    expect(result.new_balance).toBe(5);
    expect(result.attempts_remaining).toBe(2);
    expect(ledger.calls[0].idempotencyKey).toBe(`bonus:${prisma.attempts[0].id}`);
    expect(referral.calls).toHaveLength(1);
    expect(notifications.credited).toHaveLength(1);
    expect(notifications.credited[0]).toMatchObject({ userId, coins: 5, sourceType: 'bonus' });
  });

  it('a zero-coin prize records the attempt but writes no ledger row', async () => {
    const service = buildService(prisma, ledger, referral, () => 0); // first slot: 0 coins
    const result = await service.play(userId, BonusKind.scratch);
    expect(result.prize_coins).toBe(0);
    expect(result.new_balance).toBe(0);
    expect(ledger.calls).toHaveLength(0);
    expect(referral.calls).toHaveLength(0);
    expect(prisma.attempts).toHaveLength(1);
  });

  it('enforces the daily attempt limit (429)', async () => {
    const service = buildService(prisma, ledger, referral, () => 0);
    await service.play(userId, BonusKind.scratch);
    await service.play(userId, BonusKind.scratch);
    await service.play(userId, BonusKind.scratch);
    await expect(service.play(userId, BonusKind.scratch)).rejects.toMatchObject({ status: 429 });
    expect(prisma.attempts).toHaveLength(3);
  });

  it('getState reports per-day remaining without consuming an attempt', async () => {
    const service = buildService(prisma, ledger, referral, () => 0);
    await service.play(userId, BonusKind.scratch);
    const state = await service.getState(userId, BonusKind.scratch);
    expect(state).toMatchObject({
      type: BonusKind.scratch,
      attempts_per_day: 3,
      attempts_remaining: 2,
      unlocked: true,
    });
  });

  it('getState exposes the distinct prize set (for the spin wheel segments)', async () => {
    const service = buildService(prisma, ledger, referral, () => 0);
    const state = await service.getState(userId, BonusKind.scratch);
    // TABLE = 0,2,5,20,100 (all distinct) in table order.
    expect(state.prizes).toEqual([0, 2, 5, 20, 100]);
  });

  describe('two-step spin (roll → claim)', () => {
    beforeEach(() => {
      prisma.setConfig(BonusKind.spin, 1, TABLE);
    });

    it('roll reserves + returns the prize but does NOT credit', async () => {
      const service = buildService(prisma, ledger, referral, () => 65); // → 5 coins
      const roll = await service.roll(userId, BonusKind.spin);
      expect(roll.prize_coins).toBe(5);
      expect(roll.attempts_remaining).toBe(0);
      expect(roll.reservation_id).toBe(prisma.attempts[0].id);
      // Nothing credited yet — the attempt is only reserved.
      expect(ledger.calls).toHaveLength(0);
      expect(prisma.attempts).toHaveLength(1);
    });

    it('roll consumes the daily attempt (a second roll is rejected 429)', async () => {
      const service = buildService(prisma, ledger, referral, () => 65);
      await service.roll(userId, BonusKind.spin);
      await expect(service.roll(userId, BonusKind.spin)).rejects.toMatchObject({ status: 429 });
    });

    it('claim credits the reserved prize exactly once (idempotent)', async () => {
      const notifications = new RecordingNotificationHook();
      const service = buildService(prisma, ledger, referral, () => 65, notifications);
      const roll = await service.roll(userId, BonusKind.spin);
      const first = await service.claim(userId, roll.reservation_id);
      expect(first.prize_coins).toBe(5);
      expect(first.new_balance).toBe(5);
      expect(ledger.calls[0].idempotencyKey).toBe(`bonus:${roll.reservation_id}`);
      expect(referral.calls).toHaveLength(1);
      expect(notifications.credited).toHaveLength(1);
      // Re-claiming the same reservation is a no-op credit (no double-count).
      const second = await service.claim(userId, roll.reservation_id);
      expect(second.new_balance).toBe(5);
      expect(ledger.calls).toHaveLength(1);
      expect(referral.calls).toHaveLength(1);
      expect(notifications.credited).toHaveLength(1);
    });

    it('a zero-coin reserved prize claims with no ledger row', async () => {
      const service = buildService(prisma, ledger, referral, () => 0); // → 0 coins
      const roll = await service.roll(userId, BonusKind.spin);
      const result = await service.claim(userId, roll.reservation_id);
      expect(result.prize_coins).toBe(0);
      expect(ledger.calls).toHaveLength(0);
    });

    it('claiming an unknown or foreign reservation is rejected (404)', async () => {
      const service = buildService(prisma, ledger, referral, () => 65);
      await expect(service.claim(userId, randomUUID())).rejects.toMatchObject({ status: 404 });
      const roll = await service.roll(userId, BonusKind.spin);
      await expect(service.claim(randomUUID(), roll.reservation_id)).rejects.toMatchObject({
        status: 404,
      });
    });

    it('the same roll/claim logic serves scratch (reserve → credit)', async () => {
      // Scratch config seeded in the outer beforeEach (attemptsPerDay 3, TABLE).
      const service = buildService(prisma, ledger, referral, () => 65); // → 5 coins
      const roll = await service.roll(userId, BonusKind.scratch);
      expect(roll.prize_coins).toBe(5);
      expect(roll.attempts_remaining).toBe(2); // 3/day − 1
      expect(ledger.calls).toHaveLength(0); // reserved, not credited
      const claim = await service.claim(userId, roll.reservation_id);
      expect(claim.prize_coins).toBe(5);
      expect(claim.new_balance).toBe(5);
      expect(ledger.calls).toHaveLength(1);
    });
  });

  it('is tamper-resistant: the prize comes only from the server roll, not client input', async () => {
    // play() accepts NO prize/score input — the outcome is fixed by the server
    // entropy alone. With the roll forced to 96, the last slot (100) is selected
    // deterministically no matter what a client might attempt to send.
    const service = buildService(prisma, ledger, referral, () => 96);
    const result = await service.play(userId, BonusKind.scratch);
    expect(result.prize_coins).toBe(100);
    expect(rollWeighted(TABLE, () => 96)).toBe(100);
  });

  it('weighted distribution matches the table over many CSPRNG rolls', () => {
    const N = 60_000;
    const counts = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const prize = rollWeighted(TABLE, cryptoRandomInt);
      counts.set(prize, (counts.get(prize) ?? 0) + 1);
    }
    const total = TABLE.reduce((s, e) => s + e.weight, 0);
    for (const entry of TABLE) {
      const expected = entry.weight / total;
      const observed = (counts.get(entry.coins) ?? 0) / N;
      // within 3 percentage points — comfortably inside sampling noise at N=60k
      expect(Math.abs(observed - expected)).toBeLessThan(0.03);
    }
  });

  it('the same attempt id credits exactly once (idempotency key bonus:<attemptId>)', async () => {
    const service = buildService(prisma, ledger, referral, () => 65);
    const result = await service.play(userId, BonusKind.scratch);
    const key = ledger.calls[0].idempotencyKey;
    // Replaying the same idempotency key is a no-op on the ledger.
    const replay = await ledger.record({
      userId,
      amount: result.prize_coins,
      sourceType: 'bonus',
      idempotencyKey: key,
    });
    expect(replay.duplicate).toBe(true);
    expect(ledger.calls).toHaveLength(1);
  });
});
