import { randomUUID } from 'node:crypto';
import { CoinLedger, Prisma } from '@prisma/client';

interface FakeUser {
  id: string;
  coinBalanceCached: number;
}

interface Snapshot {
  users: Map<string, FakeUser>;
  ledger: CoinLedger[];
}

/**
 * In-memory stand-in for the slice of the Prisma surface LedgerService (and the
 * reconciliation job) touch. Faithfully simulates the two DB behaviors the
 * ledger design leans on:
 *
 *  1. The UNIQUE constraint on coin_ledger.idempotency_key — a duplicate insert
 *     throws a real Prisma.PrismaClientKnownRequestError with code P2002.
 *  2. Row-lock serialization — $transaction callbacks run strictly one at a
 *     time (a global mutex, i.e. at least as strict as SELECT ... FOR UPDATE),
 *     and roll back all state changes when the callback throws.
 *
 * `simulateIdempotencyRace(key)` makes the *in-transaction* findUnique
 * pre-check miss once for that key, forcing the insert to hit the P2002 path —
 * reproducing the true concurrent-insert race deterministically.
 */
export class FakeLedgerPrisma {
  private users = new Map<string, FakeUser>();
  private ledger: CoinLedger[] = [];
  private txTail: Promise<unknown> = Promise.resolve();
  private raceKeys = new Set<string>();

  // ─── test helpers ───

  addUser(id: string, coinBalanceCached = 0): void {
    this.users.set(id, { id, coinBalanceCached });
  }

  cachedBalanceOf(id: string): number {
    const user = this.users.get(id);
    if (!user) throw new Error(`fake: unknown user ${id}`);
    return user.coinBalanceCached;
  }

  /** Directly corrupt the cache (bypassing the ledger) — for drift tests only. */
  corruptCachedBalance(id: string, value: number): void {
    const user = this.users.get(id);
    if (!user) throw new Error(`fake: unknown user ${id}`);
    user.coinBalanceCached = value;
  }

  get entries(): readonly CoinLedger[] {
    return this.ledger;
  }

  entriesOf(userId: string): CoinLedger[] {
    return this.ledger.filter((e) => e.userId === userId);
  }

  sumOf(userId: string): number {
    return this.entriesOf(userId).reduce((acc, e) => acc + e.amount, 0);
  }

  simulateIdempotencyRace(key: string): void {
    this.raceKeys.add(key);
  }

  // ─── Prisma surface (transactional) ───

  async $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const snapshot = this.snapshot();
      try {
        return await fn(this.txClient() as unknown as Prisma.TransactionClient);
      } catch (err) {
        this.restore(snapshot);
        throw err;
      }
    };
    const result = this.txTail.then(run, run);
    this.txTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private txClient(): Record<string, unknown> {
    return {
      $queryRaw: (_strings: TemplateStringsArray, ...values: unknown[]) => {
        // LedgerService only issues the SELECT ... FOR UPDATE user-row lock here.
        const userId = String(values[0]);
        const user = this.users.get(userId);
        return Promise.resolve(
          user ? [{ id: user.id, coin_balance_cached: user.coinBalanceCached }] : [],
        );
      },
      coinLedger: {
        findUnique: (args: { where: { idempotencyKey?: string; id?: string } }) => {
          const { idempotencyKey, id } = args.where;
          if (idempotencyKey !== undefined && this.raceKeys.has(idempotencyKey)) {
            // Simulated race window: the concurrent writer's row is not yet visible.
            this.raceKeys.delete(idempotencyKey);
            return Promise.resolve(null);
          }
          return Promise.resolve(this.findLedger({ idempotencyKey, id }));
        },
        create: (args: { data: Omit<CoinLedger, 'id' | 'createdAt'> }) => {
          const { data } = args;
          if (this.findLedger({ idempotencyKey: data.idempotencyKey })) {
            throw new Prisma.PrismaClientKnownRequestError(
              'Unique constraint failed on the fields: (`idempotency_key`)',
              { code: 'P2002', clientVersion: 'fake', meta: { target: ['idempotency_key'] } },
            );
          }
          const row: CoinLedger = {
            id: randomUUID(),
            createdAt: new Date(),
            ...data,
          };
          this.ledger.push(row);
          return Promise.resolve(row);
        },
      },
      user: {
        update: (args: { where: { id: string }; data: { coinBalanceCached: number } }) => {
          const user = this.users.get(args.where.id);
          if (!user) {
            throw new Prisma.PrismaClientKnownRequestError('Record not found', {
              code: 'P2025',
              clientVersion: 'fake',
            });
          }
          user.coinBalanceCached = args.data.coinBalanceCached;
          return Promise.resolve({ ...user });
        },
      },
    };
  }

  // ─── Prisma surface (non-transactional reads) ───

  readonly coinLedger = {
    findUnique: (args: { where: { idempotencyKey?: string; id?: string } }) =>
      Promise.resolve(this.findLedger(args.where)),
    aggregate: (args: { where: { userId: string } }) => {
      const rows = this.entriesOf(args.where.userId);
      const sum = rows.length === 0 ? null : rows.reduce((acc, e) => acc + e.amount, 0);
      return Promise.resolve({ _sum: { amount: sum } });
    },
    groupBy: (args: { where: { userId: { in: string[] } } }) => {
      const result: Array<{ userId: string; _sum: { amount: number | null } }> = [];
      for (const userId of args.where.userId.in) {
        const rows = this.entriesOf(userId);
        if (rows.length > 0) {
          result.push({ userId, _sum: { amount: rows.reduce((acc, e) => acc + e.amount, 0) } });
        }
      }
      return Promise.resolve(result);
    },
  };

  readonly user = {
    findUnique: (args: { where: { id: string } }) => {
      const user = this.users.get(args.where.id);
      return Promise.resolve(user ? { ...user } : null);
    },
    findMany: (args: {
      orderBy: { id: 'asc' };
      take: number;
      cursor?: { id: string };
      skip?: number;
    }) => {
      let all = [...this.users.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
      if (args.cursor) {
        const idx = all.findIndex((u) => u.id === args.cursor?.id);
        all = idx >= 0 ? all.slice(idx + (args.skip ?? 0)) : [];
      }
      return Promise.resolve(all.slice(0, args.take).map((u) => ({ ...u })));
    },
  };

  // ─── internals ───

  private findLedger(where: { idempotencyKey?: string; id?: string }): CoinLedger | null {
    if (where.idempotencyKey !== undefined) {
      return this.ledger.find((e) => e.idempotencyKey === where.idempotencyKey) ?? null;
    }
    if (where.id !== undefined) {
      return this.ledger.find((e) => e.id === where.id) ?? null;
    }
    return null;
  }

  private snapshot(): Snapshot {
    return {
      users: new Map([...this.users.entries()].map(([k, v]) => [k, { ...v }])),
      ledger: [...this.ledger],
    };
  }

  private restore(snapshot: Snapshot): void {
    this.users = snapshot.users;
    this.ledger = snapshot.ledger;
  }
}
