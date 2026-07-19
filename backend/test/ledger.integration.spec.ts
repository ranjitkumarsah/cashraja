/**
 * DB-gated integration suite (A3.6): runs the ledger against a real Postgres —
 * true row-lock serialization, real unique constraints, real transactions.
 *
 * Auto-skips when DATABASE_URL is unset or unreachable (unit runs stay green
 * without infrastructure). To run locally:
 *   docker compose up -d postgres
 *   npx prisma migrate deploy
 *   DATABASE_URL=postgresql://cashraja:cashraja@localhost:5432/cashraja?schema=public npm test
 */
import { randomUUID } from 'node:crypto';
import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { InsufficientBalanceError } from '../src/modules/ledger/ledger.errors';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { isDatabaseReachable } from './support/db-reachable';

const describeDb = isDatabaseReachable() ? describe : describe.skip;

describeDb('LedgerService (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let ledger: LedgerService;
  const createdUserIds: string[] = [];

  async function createUser(balance = 0): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        googleUid: `it-${id}`,
        email: `it-${id}@test.local`,
        displayName: 'Integration Test',
        referralCode: `IT${id.slice(0, 10)}`,
        coinBalanceCached: 0,
      },
    });
    createdUserIds.push(id);
    if (balance > 0) {
      await ledger.record({
        userId: id,
        amount: balance,
        sourceType: LedgerSourceType.admin_adjustment,
        idempotencyKey: `seed:${id}`,
      });
    }
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.ping();
    ledger = new LedgerService(prisma);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.coinLedger.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('credits and write-through-updates the cached balance', async () => {
    const userId = await createUser();

    const result = await ledger.record({
      userId,
      amount: 75,
      sourceType: LedgerSourceType.offer,
      sourceRefId: 'completion-1',
      idempotencyKey: `it:${userId}:credit`,
    });

    expect(result.duplicate).toBe(false);
    expect(result.entry.balanceAfter).toBe(75);
    await expect(ledger.getBalance(userId)).resolves.toBe(75);
    await expect(ledger.getCachedBalance(userId)).resolves.toBe(75);
  });

  it('duplicate postback (same idempotency key twice) credits exactly once — E2E #4', async () => {
    const userId = await createUser();
    const key = `adjoe:${randomUUID()}`;

    const [first, second] = await Promise.all([
      ledger.record({ userId, amount: 50, sourceType: 'offer', idempotencyKey: key }),
      ledger.record({ userId, amount: 50, sourceType: 'offer', idempotencyKey: key }),
    ]);
    const third = await ledger.record({
      userId,
      amount: 50,
      sourceType: 'offer',
      idempotencyKey: key,
    });

    expect([first.duplicate, second.duplicate].filter((d) => !d)).toHaveLength(1);
    expect(third.duplicate).toBe(true);
    const rows = await prisma.coinLedger.findMany({ where: { userId } });
    expect(rows.filter((r) => r.idempotencyKey === key)).toHaveLength(1);
    await expect(ledger.getBalance(userId)).resolves.toBe(50);
    await expect(ledger.getCachedBalance(userId)).resolves.toBe(50);
  });

  it('TRUE concurrency: parallel reserveDebit for the full balance — only one wins (E2E #5)', async () => {
    const userId = await createUser(100);

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        ledger.reserveDebit({
          userId,
          amount: 100,
          sourceRefId: `redemption-${i}`,
          idempotencyKey: `it:${userId}:reserve-${i}`,
        }),
      ),
    );

    const wins = outcomes.filter((o) => o.status === 'fulfilled');
    const insufficient = outcomes.filter(
      (o) => o.status === 'rejected' && o.reason instanceof InsufficientBalanceError,
    );
    expect(wins).toHaveLength(1);
    expect(insufficient).toHaveLength(4);
    await expect(ledger.getBalance(userId)).resolves.toBe(0);
    await expect(ledger.getCachedBalance(userId)).resolves.toBe(0);
  });

  it('parallel mixed credits keep cached == SUM(ledger)', async () => {
    const userId = await createUser();

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        ledger.record({
          userId,
          amount: 5 + i,
          sourceType: LedgerSourceType.game,
          idempotencyKey: `it:${userId}:mix-${i}`,
        }),
      ),
    );

    const sum = await ledger.getBalance(userId);
    const cached = await ledger.getCachedBalance(userId);
    expect(cached).toBe(sum);
    expect(sum).toBe(Array.from({ length: 20 }, (_, i) => 5 + i).reduce((a, b) => a + b, 0));
  });

  it('reject flow: reverse returns the reserved coins via a compensating row — E2E #3', async () => {
    const userId = await createUser(200);

    const reserve = await ledger.reserveDebit({
      userId,
      amount: 150,
      idempotencyKey: `it:${userId}:reserve`,
    });
    const reversal = await ledger.reverse(reserve.entry.id, `it:${userId}:reversal`);

    expect(reversal.entry.amount).toBe(150);
    expect(reversal.entry.sourceRefId).toBe(reserve.entry.id);
    await expect(ledger.getBalance(userId)).resolves.toBe(200);
    await expect(ledger.getCachedBalance(userId)).resolves.toBe(200);

    // original never mutated
    const original = await prisma.coinLedger.findUnique({ where: { id: reserve.entry.id } });
    expect(original?.amount).toBe(-150);
  });
});
