import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

/**
 * In-memory Prisma stand-in for the Phase B surface (postback intake,
 * processor, expiry job, wallet, offers, app-config). Same philosophy as
 * FakeLedgerPrisma: faithfully simulates the DB behaviors the design leans
 * on — the (network, external_txn_id) unique constraint (real P2002), uuid
 * validation (P2023) and jsonb path dedupe lookups.
 */

export interface FakeUser {
  id: string;
  country: string | null;
  coinBalanceCached: number;
}

export interface FakeOffer {
  id: string;
  network: string;
  externalOfferId: string;
  title: string;
  description: string | null;
  coinReward: number;
  requirements: unknown;
  isActive: boolean;
}

export interface FakeCompletion {
  id: string;
  userId: string;
  offerId: string | null;
  network: string;
  externalTxnId: string;
  status: string;
  coinReward: number;
  statusReason: string | null;
  networkPayload: unknown;
  creditedAt: Date | null;
  createdAt: Date;
}

export interface FakeImpression {
  id: string;
  userId: string;
  network: string;
  adUnitId: string;
  coinReward: number;
  verified: boolean;
  ssvPayload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface FakeLedgerRow {
  id: string;
  userId: string;
  amount: number;
  sourceType: string;
  sourceRefId: string | null;
  idempotencyKey: string;
  balanceAfter: number;
  createdAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function p(code: string, message: string, target?: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'fake',
    meta: target !== undefined ? { target } : undefined,
  });
}

export class FakePhaseBPrisma {
  usersById = new Map<string, FakeUser>();
  offers: FakeOffer[] = [];
  completions: FakeCompletion[] = [];
  impressions: FakeImpression[] = [];
  ledgerRows: FakeLedgerRow[] = [];
  appConfigRows: Array<{ key: string; value: unknown; version: number }> = [];

  addUser(id: string = randomUUID(), country: string | null = 'IN'): string {
    this.usersById.set(id, { id, country, coinBalanceCached: 0 });
    return id;
  }

  addOffer(partial: Partial<FakeOffer> & { externalOfferId: string }): FakeOffer {
    const offer: FakeOffer = {
      id: randomUUID(),
      network: 'mock',
      title: partial.externalOfferId,
      description: null,
      coinReward: 100,
      requirements: null,
      isActive: true,
      ...partial,
    };
    this.offers.push(offer);
    return offer;
  }

  addCompletion(partial: Partial<FakeCompletion> & { userId: string }): FakeCompletion {
    const completion: FakeCompletion = {
      id: randomUUID(),
      offerId: null,
      network: 'mock',
      externalTxnId: randomUUID(),
      status: 'pending',
      coinReward: 100,
      statusReason: null,
      networkPayload: null,
      creditedAt: null,
      createdAt: new Date(),
      ...partial,
    };
    this.completions.push(completion);
    return completion;
  }

  addImpression(partial: Partial<FakeImpression> & { userId: string }): FakeImpression {
    const impression: FakeImpression = {
      id: randomUUID(),
      network: 'mock',
      adUnitId: 'mock-rewarded',
      coinReward: 5,
      verified: true,
      ssvPayload: null,
      createdAt: new Date(),
      ...partial,
    };
    this.impressions.push(impression);
    return impression;
  }

  addLedgerRow(partial: Partial<FakeLedgerRow> & { userId: string; amount: number }): FakeLedgerRow {
    const row: FakeLedgerRow = {
      id: randomUUID(),
      sourceType: 'offer',
      sourceRefId: null,
      idempotencyKey: randomUUID(),
      balanceAfter: 0,
      createdAt: new Date(),
      ...partial,
    };
    this.ledgerRows.push(row);
    return row;
  }

  setConfig(key: string, value: unknown, version = 1): void {
    this.appConfigRows.push({ key, value, version });
  }

  // ─── prisma.user ───

  readonly user = {
    findUnique: (args: { where: { id: string }; select?: unknown }) => {
      if (!UUID_RE.test(args.where.id)) {
        throw p('P2023', 'Error creating UUID, invalid character');
      }
      const user = this.usersById.get(args.where.id);
      return Promise.resolve(user ? { ...user } : null);
    },
  };

  // ─── prisma.offer ───

  readonly offer = {
    findUnique: (args: {
      where: {
        id?: string;
        network_externalOfferId?: { network: string; externalOfferId: string };
      };
      select?: unknown;
    }) => {
      const { id, network_externalOfferId: compound } = args.where;
      if (id !== undefined) {
        if (!UUID_RE.test(id)) throw p('P2023', 'invalid uuid');
        return Promise.resolve(this.offers.find((o) => o.id === id) ?? null);
      }
      if (compound) {
        return Promise.resolve(
          this.offers.find(
            (o) =>
              o.network === compound.network && o.externalOfferId === compound.externalOfferId,
          ) ?? null,
        );
      }
      return Promise.resolve(null);
    },
    findMany: (args: {
      where: { isActive: boolean; network: { in: string[] } };
      orderBy?: unknown;
    }) => {
      const rows = this.offers
        .filter(
          (o) => o.isActive === args.where.isActive && args.where.network.in.includes(o.network),
        )
        .sort((a, b) => b.coinReward - a.coinReward);
      return Promise.resolve(rows.map((o) => ({ ...o })));
    },
  };

  // ─── prisma.offerCompletion ───

  readonly offerCompletion = {
    create: (args: { data: Record<string, unknown> }) => {
      const d = args.data;
      const network = d['network'] as string;
      const externalTxnId = d['externalTxnId'] as string;
      if (
        this.completions.some((c) => c.network === network && c.externalTxnId === externalTxnId)
      ) {
        throw p('P2002', 'Unique constraint failed', ['network', 'external_txn_id']);
      }
      const userId = d['userId'] as string;
      if (!UUID_RE.test(userId)) {
        throw p('P2023', 'Error creating UUID, invalid character');
      }
      if (!this.usersById.has(userId)) {
        // Faithful FK simulation: Prisma surfaces this as P2003 with field_name meta.
        const err = p('P2003', 'Foreign key constraint violated');
        err.meta = { field_name: 'offer_completions_user_id_fkey (index)' };
        throw err;
      }
      const row: FakeCompletion = {
        id: randomUUID(),
        userId: d['userId'] as string,
        offerId: (d['offerId'] as string | null) ?? null,
        network,
        externalTxnId,
        status: (d['status'] as string) ?? 'pending',
        coinReward: (d['coinReward'] as number) ?? 0,
        statusReason: null,
        networkPayload: d['networkPayload'] ?? null,
        creditedAt: null,
        createdAt: new Date(),
      };
      this.completions.push(row);
      return Promise.resolve({ ...row });
    },
    findUnique: (args: {
      where: {
        id?: string;
        network_externalTxnId?: { network: string; externalTxnId: string };
      };
      select?: unknown;
    }) => {
      const { id, network_externalTxnId: compound } = args.where;
      if (id !== undefined) {
        return Promise.resolve(this.completions.find((c) => c.id === id) ?? null);
      }
      if (compound) {
        return Promise.resolve(
          this.completions.find(
            (c) => c.network === compound.network && c.externalTxnId === compound.externalTxnId,
          ) ?? null,
        );
      }
      return Promise.resolve(null);
    },
    findMany: (args: {
      where: { userId: string; offerId?: { in: (string | null)[] }; status?: { in: string[] } };
      select?: unknown;
    }) => {
      const rows = this.completions.filter((c) => {
        if (c.userId !== args.where.userId) return false;
        if (args.where.offerId && !args.where.offerId.in.includes(c.offerId)) return false;
        if (args.where.status && !args.where.status.in.includes(c.status)) return false;
        return true;
      });
      return Promise.resolve(rows.map((c) => ({ ...c })));
    },
    updateMany: (args: {
      where: { id?: string; status?: string; createdAt?: { lt: Date } };
      data: Partial<FakeCompletion>;
    }) => {
      let count = 0;
      for (const c of this.completions) {
        if (args.where.id !== undefined && c.id !== args.where.id) continue;
        if (args.where.status !== undefined && c.status !== args.where.status) continue;
        if (args.where.createdAt && !(c.createdAt < args.where.createdAt.lt)) continue;
        Object.assign(c, args.data);
        count += 1;
      }
      return Promise.resolve({ count });
    },
    aggregate: (args: { where: { userId: string; status: string }; _sum: unknown }) => {
      const rows = this.completions.filter(
        (c) => c.userId === args.where.userId && c.status === args.where.status,
      );
      const sum = rows.length === 0 ? null : rows.reduce((acc, c) => acc + c.coinReward, 0);
      return Promise.resolve({ _sum: { coinReward: sum } });
    },
  };

  // ─── prisma.adImpression ───

  readonly adImpression = {
    create: (args: { data: Record<string, unknown>; select?: unknown }) => {
      const d = args.data;
      const row: FakeImpression = {
        id: randomUUID(),
        userId: d['userId'] as string,
        network: d['network'] as string,
        adUnitId: d['adUnitId'] as string,
        coinReward: d['coinReward'] as number,
        verified: (d['verified'] as boolean) ?? false,
        ssvPayload: (d['ssvPayload'] as Record<string, unknown> | null) ?? null,
        createdAt: new Date(),
      };
      this.impressions.push(row);
      return Promise.resolve({ ...row });
    },
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.impressions.find((i) => i.id === args.where.id) ?? null),
    findFirst: (args: {
      where: {
        network: string;
        ssvPayload: { path: string[]; equals: string };
      };
      select?: unknown;
    }) => {
      const { network, ssvPayload } = args.where;
      const field = ssvPayload.path[0] ?? '';
      const row = this.impressions.find(
        (i) => i.network === network && i.ssvPayload?.[field] === ssvPayload.equals,
      );
      return Promise.resolve(row ? { ...row } : null);
    },
    count: (args: {
      where: {
        userId: string;
        verified: boolean;
        coinReward: { gt: number };
        createdAt: { gte: Date };
      };
    }) => {
      const w = args.where;
      return Promise.resolve(
        this.impressions.filter(
          (i) =>
            i.userId === w.userId &&
            i.verified === w.verified &&
            i.coinReward > w.coinReward.gt &&
            i.createdAt >= w.createdAt.gte,
        ).length,
      );
    },
  };

  // ─── prisma.coinLedger (wallet reads) ───

  readonly coinLedger = {
    findMany: (args: {
      where: {
        userId: string;
        OR?: Array<
          { createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } }
        >;
      };
      orderBy?: unknown;
      take?: number;
    }) => {
      let rows = this.ledgerRows.filter((r) => r.userId === args.where.userId);
      const or = args.where.OR;
      if (or) {
        rows = rows.filter((r) =>
          or.some((clause) => {
            if ('id' in clause) {
              return r.createdAt.getTime() === clause.createdAt.getTime() && r.id < clause.id.lt;
            }
            return r.createdAt < clause.createdAt.lt;
          }),
        );
      }
      rows = [...rows].sort((a, b) => {
        const dt = b.createdAt.getTime() - a.createdAt.getTime();
        if (dt !== 0) return dt;
        return a.id < b.id ? 1 : -1;
      });
      if (args.take !== undefined) rows = rows.slice(0, args.take);
      return Promise.resolve(rows.map((r) => ({ ...r })));
    },
  };

  // ─── prisma.appConfig ───

  readonly appConfig = {
    findFirst: (args: { where: { key: string }; orderBy?: unknown; select?: unknown }) => {
      const rows = this.appConfigRows
        .filter((r) => r.key === args.where.key)
        .sort((a, b) => b.version - a.version);
      const row = rows[0];
      return Promise.resolve(row ? { value: row.value } : null);
    },
  };
}

/** Queue fake: records enqueued jobs; `drain` runs them through a processor. */
export class FakePostbackQueue {
  jobs: Array<{ kind: 'offer'; completionId: string } | { kind: 'ad'; impressionId: string }> = [];
  failNext = false;

  async enqueue(data: (typeof this.jobs)[number]): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('fake queue: redis unavailable');
    }
    this.jobs.push(data);
  }

  async close(): Promise<void> {}

  async drain(process: (data: (typeof this.jobs)[number]) => Promise<void>): Promise<void> {
    while (this.jobs.length > 0) {
      const job = this.jobs.shift();
      if (job) await process(job);
    }
  }
}

/** LedgerService fake for processor tests: idempotency-aware record(). */
export class FakeLedgerService {
  calls: Array<{
    userId: string;
    amount: number;
    sourceType: string;
    sourceRefId?: string;
    idempotencyKey: string;
  }> = [];
  private keys = new Set<string>();

  async record(params: {
    userId: string;
    amount: number;
    sourceType: string;
    sourceRefId?: string;
    idempotencyKey: string;
  }): Promise<{ entry: { id: string }; duplicate: boolean }> {
    const duplicate = this.keys.has(params.idempotencyKey);
    if (!duplicate) {
      this.keys.add(params.idempotencyKey);
      this.calls.push(params);
    }
    return { entry: { id: randomUUID() }, duplicate };
  }
}
