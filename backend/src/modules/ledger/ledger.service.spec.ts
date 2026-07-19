import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InsufficientBalanceError,
  InvalidLedgerAmountError,
  LedgerEntryNotFoundError,
  LedgerUserNotFoundError,
} from './ledger.errors';
import { LedgerService } from './ledger.service';
import { FakeLedgerPrisma } from './testing/fake-prisma';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('LedgerService', () => {
  let fake: FakeLedgerPrisma;
  let ledger: LedgerService;

  beforeEach(() => {
    fake = new FakeLedgerPrisma();
    ledger = new LedgerService(fake as unknown as PrismaService);
    fake.addUser(USER);
    fake.addUser(OTHER);
  });

  describe('record()', () => {
    it.each(Object.values(LedgerSourceType))(
      'writes a correctly signed credit row for source_type=%s',
      async (sourceType) => {
        const result = await ledger.record({
          userId: USER,
          amount: 25,
          sourceType,
          sourceRefId: 'ref-1',
          idempotencyKey: `key-${sourceType}`,
        });

        expect(result.duplicate).toBe(false);
        expect(result.entry.amount).toBe(25);
        expect(result.entry.sourceType).toBe(sourceType);
        expect(result.entry.sourceRefId).toBe('ref-1');
        expect(result.entry.balanceAfter).toBe(25);
        expect(fake.cachedBalanceOf(USER)).toBe(25);
        expect(fake.sumOf(USER)).toBe(25);
      },
    );

    it.each(Object.values(LedgerSourceType))(
      'writes a correctly signed debit row for source_type=%s',
      async (sourceType) => {
        await ledger.record({
          userId: USER,
          amount: 100,
          sourceType: LedgerSourceType.offer,
          idempotencyKey: 'seed',
        });

        const result = await ledger.record({
          userId: USER,
          amount: -40,
          sourceType,
          idempotencyKey: `debit-${sourceType}`,
        });

        expect(result.entry.amount).toBe(-40);
        expect(result.entry.balanceAfter).toBe(60);
        expect(fake.cachedBalanceOf(USER)).toBe(60);
        expect(fake.sumOf(USER)).toBe(60);
      },
    );

    it('computes balance_after cumulatively across entries', async () => {
      await ledger.record({ userId: USER, amount: 10, sourceType: 'game', idempotencyKey: 'a' });
      await ledger.record({ userId: USER, amount: 15, sourceType: 'ad', idempotencyKey: 'b' });
      const third = await ledger.record({
        userId: USER,
        amount: -5,
        sourceType: 'admin_adjustment',
        idempotencyKey: 'c',
      });

      expect(third.entry.balanceAfter).toBe(20);
      expect(fake.cachedBalanceOf(USER)).toBe(20);
    });

    it('rejects zero and non-integer amounts', async () => {
      await expect(
        ledger.record({ userId: USER, amount: 0, sourceType: 'game', idempotencyKey: 'z' }),
      ).rejects.toBeInstanceOf(InvalidLedgerAmountError);
      await expect(
        ledger.record({ userId: USER, amount: 1.5, sourceType: 'game', idempotencyKey: 'f' }),
      ).rejects.toBeInstanceOf(InvalidLedgerAmountError);
      expect(fake.entries).toHaveLength(0);
    });

    it('throws for an unknown user and writes nothing', async () => {
      await expect(
        ledger.record({
          userId: '99999999-9999-4999-8999-999999999999',
          amount: 10,
          sourceType: 'game',
          idempotencyKey: 'nouser',
        }),
      ).rejects.toBeInstanceOf(LedgerUserNotFoundError);
      expect(fake.entries).toHaveLength(0);
    });
  });

  describe('idempotency (A3.2)', () => {
    it('duplicate idempotency_key is a no-op returning the original row — never a double credit', async () => {
      const first = await ledger.record({
        userId: USER,
        amount: 50,
        sourceType: 'offer',
        idempotencyKey: 'adjoe:txn-1',
      });
      const second = await ledger.record({
        userId: USER,
        amount: 50,
        sourceType: 'offer',
        idempotencyKey: 'adjoe:txn-1',
      });

      expect(second.duplicate).toBe(true);
      expect(second.entry.id).toBe(first.entry.id);
      expect(fake.entriesOf(USER)).toHaveLength(1);
      expect(fake.cachedBalanceOf(USER)).toBe(50);
    });

    it('duplicate no-ops even when the retry carries a different amount', async () => {
      await ledger.record({ userId: USER, amount: 50, sourceType: 'offer', idempotencyKey: 'k1' });
      const retry = await ledger.record({
        userId: USER,
        amount: 999,
        sourceType: 'offer',
        idempotencyKey: 'k1',
      });

      expect(retry.duplicate).toBe(true);
      expect(retry.entry.amount).toBe(50);
      expect(fake.cachedBalanceOf(USER)).toBe(50);
    });

    it('unique-violation race (P2002 after the pre-check missed) resolves to the existing row', async () => {
      const first = await ledger.record({
        userId: USER,
        amount: 30,
        sourceType: 'ad',
        idempotencyKey: 'race-key',
      });

      // Make the in-transaction pre-check miss so the INSERT hits the DB constraint.
      fake.simulateIdempotencyRace('race-key');
      const second = await ledger.record({
        userId: USER,
        amount: 30,
        sourceType: 'ad',
        idempotencyKey: 'race-key',
      });

      expect(second.duplicate).toBe(true);
      expect(second.entry.id).toBe(first.entry.id);
      expect(fake.entriesOf(USER)).toHaveLength(1);
      expect(fake.cachedBalanceOf(USER)).toBe(30); // rolled back — no cache corruption
    });

    it('parallel writes with the same key credit exactly once', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          ledger.record({ userId: USER, amount: 20, sourceType: 'game', idempotencyKey: 'same' }),
        ),
      );

      expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
      expect(fake.entriesOf(USER)).toHaveLength(1);
      expect(fake.cachedBalanceOf(USER)).toBe(20);
    });
  });

  describe('reserveDebit() (A3.3)', () => {
    it('debits immediately when balance is sufficient', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });

      const result = await ledger.reserveDebit({
        userId: USER,
        amount: 60,
        sourceRefId: 'redemption-1',
        idempotencyKey: 'redeem:1',
      });

      expect(result.entry.amount).toBe(-60);
      expect(result.entry.sourceType).toBe(LedgerSourceType.redemption);
      expect(result.entry.balanceAfter).toBe(40);
      expect(fake.cachedBalanceOf(USER)).toBe(40);
    });

    it('allows spending the exact balance down to zero', async () => {
      await ledger.record({ userId: USER, amount: 80, sourceType: 'offer', idempotencyKey: 's' });
      const result = await ledger.reserveDebit({
        userId: USER,
        amount: 80,
        idempotencyKey: 'redeem:all',
      });
      expect(result.entry.balanceAfter).toBe(0);
    });

    it('throws InsufficientBalanceError and writes nothing when balance is short', async () => {
      await ledger.record({ userId: USER, amount: 50, sourceType: 'offer', idempotencyKey: 's' });

      await expect(
        ledger.reserveDebit({ userId: USER, amount: 51, idempotencyKey: 'redeem:2' }),
      ).rejects.toBeInstanceOf(InsufficientBalanceError);

      expect(fake.entriesOf(USER)).toHaveLength(1);
      expect(fake.cachedBalanceOf(USER)).toBe(50);
    });

    it('rejects non-positive reserve amounts', async () => {
      await expect(
        ledger.reserveDebit({ userId: USER, amount: -5, idempotencyKey: 'bad' }),
      ).rejects.toBeInstanceOf(InvalidLedgerAmountError);
    });

    it('duplicate reserve key is a no-op — coins are not reserved twice', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });
      const first = await ledger.reserveDebit({ userId: USER, amount: 70, idempotencyKey: 'r1' });
      const retry = await ledger.reserveDebit({ userId: USER, amount: 70, idempotencyKey: 'r1' });

      expect(retry.duplicate).toBe(true);
      expect(retry.entry.id).toBe(first.entry.id);
      expect(fake.cachedBalanceOf(USER)).toBe(30);
    });

    it('two parallel reserves for more than the balance — only one wins (E2E #5)', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });

      const outcomes = await Promise.allSettled([
        ledger.reserveDebit({ userId: USER, amount: 100, idempotencyKey: 'r-a' }),
        ledger.reserveDebit({ userId: USER, amount: 100, idempotencyKey: 'r-b' }),
      ]);

      const wins = outcomes.filter((o) => o.status === 'fulfilled');
      const losses = outcomes.filter(
        (o) => o.status === 'rejected' && o.reason instanceof InsufficientBalanceError,
      );
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      expect(fake.cachedBalanceOf(USER)).toBe(0);
      expect(fake.sumOf(USER)).toBe(0);
    });
  });

  describe('reverse() (A3.3)', () => {
    it('reverses a reserve-debit with a compensating positive entry referencing the original', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });
      const reserve = await ledger.reserveDebit({
        userId: USER,
        amount: 60,
        idempotencyKey: 'r1',
      });

      const reversal = await ledger.reverse(reserve.entry.id, 'r1:reversal');

      expect(reversal.entry.amount).toBe(60);
      expect(reversal.entry.sourceRefId).toBe(reserve.entry.id);
      expect(reversal.entry.sourceType).toBe(reserve.entry.sourceType);
      expect(reversal.entry.balanceAfter).toBe(100);
      expect(fake.cachedBalanceOf(USER)).toBe(100);
    });

    it('never mutates the original entry (append-only)', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });
      const reserve = await ledger.reserveDebit({ userId: USER, amount: 40, idempotencyKey: 'r' });
      const before = { ...reserve.entry };

      await ledger.reverse(reserve.entry.id, 'rev');

      const original = fake.entriesOf(USER).find((e) => e.id === reserve.entry.id);
      expect(original).toEqual(before);
      expect(fake.entriesOf(USER)).toHaveLength(3); // credit + debit + reversal, nothing deleted
    });

    it('reverses a credit with a negative compensating entry', async () => {
      const credit = await ledger.record({
        userId: USER,
        amount: 55,
        sourceType: 'referral',
        idempotencyKey: 'c',
      });

      const reversal = await ledger.reverse(credit.entry.id, 'c:rev');

      expect(reversal.entry.amount).toBe(-55);
      expect(fake.cachedBalanceOf(USER)).toBe(0);
    });

    it('reversal is idempotent — same key never double-refunds', async () => {
      await ledger.record({ userId: USER, amount: 100, sourceType: 'offer', idempotencyKey: 's' });
      const reserve = await ledger.reserveDebit({ userId: USER, amount: 30, idempotencyKey: 'r' });

      const first = await ledger.reverse(reserve.entry.id, 'rev');
      const retry = await ledger.reverse(reserve.entry.id, 'rev');

      expect(retry.duplicate).toBe(true);
      expect(retry.entry.id).toBe(first.entry.id);
      expect(fake.cachedBalanceOf(USER)).toBe(100);
    });

    it('throws for an unknown original ledger id', async () => {
      await expect(
        ledger.reverse('00000000-0000-4000-8000-000000000000', 'x'),
      ).rejects.toBeInstanceOf(LedgerEntryNotFoundError);
    });
  });

  describe('balances', () => {
    it('getBalance is the authoritative SUM over the ledger', async () => {
      await ledger.record({ userId: USER, amount: 10, sourceType: 'game', idempotencyKey: 'a' });
      await ledger.record({ userId: USER, amount: -3, sourceType: 'redemption', idempotencyKey: 'b' });
      await ledger.record({ userId: OTHER, amount: 999, sourceType: 'offer', idempotencyKey: 'o' });

      await expect(ledger.getBalance(USER)).resolves.toBe(7);
      await expect(ledger.getCachedBalance(USER)).resolves.toBe(7);
    });

    it('getBalance is 0 for a user with no ledger rows', async () => {
      await expect(ledger.getBalance(USER)).resolves.toBe(0);
    });

    it('getCachedBalance throws for unknown user', async () => {
      await expect(
        ledger.getCachedBalance('99999999-9999-4999-8999-999999999999'),
      ).rejects.toBeInstanceOf(LedgerUserNotFoundError);
    });
  });

  describe('concurrency', () => {
    it('parallel mixed writes keep cached == SUM(ledger)', async () => {
      await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          ledger.record({
            userId: USER,
            amount: i % 2 === 0 ? 10 : -4,
            sourceType: i % 2 === 0 ? 'game' : 'admin_adjustment',
            idempotencyKey: `mix-${i}`,
          }),
        ),
      );

      expect(fake.cachedBalanceOf(USER)).toBe(fake.sumOf(USER));
      expect(fake.entriesOf(USER)).toHaveLength(25);
      // balance_after snapshots must chain consistently
      let running = 0;
      for (const entry of fake.entriesOf(USER)) {
        running += entry.amount;
        expect(entry.balanceAfter).toBe(running);
      }
    });
  });
});
