import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InsufficientBalanceError } from './ledger.errors';
import { LedgerService } from './ledger.service';
import { FakeLedgerPrisma } from './testing/fake-prisma';

/** Deterministic PRNG (mulberry32) so failures are reproducible from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCE_TYPES = Object.values(LedgerSourceType);
const SEQUENCES = 500;
const USERS = ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002'];

/**
 * A3.5 property test: for 500 randomized credit/debit sequences (mixing plain
 * records, reserve-debits, reversals, and deliberate idempotency-key replays),
 * the write-through cache always equals SUM(ledger) and the balance_after
 * chain is consistent — the core ledger invariant.
 */
describe('LedgerService property: cached balance == SUM(ledger)', () => {
  it(`holds across ${SEQUENCES} random sequences`, async () => {
    for (let seq = 0; seq < SEQUENCES; seq++) {
      const rand = mulberry32(0xcafe + seq);
      const fake = new FakeLedgerPrisma();
      const ledger = new LedgerService(fake as unknown as PrismaService);
      for (const u of USERS) fake.addUser(u);

      const recordedIds: string[] = [];
      const usedKeys: string[] = [];
      const opCount = 3 + Math.floor(rand() * 13); // 3..15 ops per sequence

      for (let op = 0; op < opCount; op++) {
        const userId = USERS[Math.floor(rand() * USERS.length)];
        const roll = rand();
        const key = `s${seq}-op${op}`;

        try {
          if (roll < 0.55) {
            // credit or debit through record()
            const amount = Math.floor(rand() * 200) - 60; // skew positive, allows negatives
            const result = await ledger.record({
              userId,
              amount: amount === 0 ? 7 : amount,
              sourceType: SOURCE_TYPES[Math.floor(rand() * SOURCE_TYPES.length)],
              idempotencyKey: key,
            });
            recordedIds.push(result.entry.id);
            usedKeys.push(key);
          } else if (roll < 0.75) {
            // reserve-debit — may legitimately fail on insufficient balance
            const result = await ledger.reserveDebit({
              userId,
              amount: 1 + Math.floor(rand() * 150),
              idempotencyKey: key,
            });
            recordedIds.push(result.entry.id);
            usedKeys.push(key);
          } else if (roll < 0.9 && recordedIds.length > 0) {
            // reverse a random earlier entry
            const target = recordedIds[Math.floor(rand() * recordedIds.length)];
            await ledger.reverse(target, `${key}-rev`);
          } else if (usedKeys.length > 0) {
            // replay an already-used idempotency key — must be a no-op
            const replayKey = usedKeys[Math.floor(rand() * usedKeys.length)];
            const result = await ledger.record({
              userId,
              amount: 123,
              sourceType: 'offer',
              idempotencyKey: replayKey,
            });
            expect(result.duplicate).toBe(true);
          }
        } catch (err) {
          if (!(err instanceof InsufficientBalanceError)) throw err;
        }
      }

      for (const userId of USERS) {
        const cached = fake.cachedBalanceOf(userId);
        const sum = fake.sumOf(userId);
        expect({ seq, userId, cached }).toEqual({ seq, userId, cached: sum });
        expect(await ledger.getBalance(userId)).toBe(sum);
        expect(cached).toBeGreaterThanOrEqual(Number.MIN_SAFE_INTEGER); // sanity

        let running = 0;
        for (const entry of fake.entriesOf(userId)) {
          running += entry.amount;
          expect(entry.balanceAfter).toBe(running);
        }
      }
    }
  });
});
