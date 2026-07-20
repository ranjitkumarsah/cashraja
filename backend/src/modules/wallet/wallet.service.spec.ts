import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { FakePhaseBPrisma } from '../postbacks/testing/fake-phase-b-prisma';
import { decodeCursor, encodeCursor, WalletService } from './wallet.service';

describe('WalletService', () => {
  let prisma: FakePhaseBPrisma;
  let service: WalletService;
  let userId: string;
  let cachedBalance: number;

  beforeEach(() => {
    prisma = new FakePhaseBPrisma();
    cachedBalance = 0;
    const ledgerStub = {
      getCachedBalance: async () => cachedBalance,
    } as unknown as LedgerService;
    service = new WalletService(prisma as unknown as PrismaService, ledgerStub);
    userId = prisma.addUser();
  });

  describe('GET /api/wallet view', () => {
    it('returns cached balance, pending offer credits and the 10 most recent entries', async () => {
      cachedBalance = 420;
      prisma.addCompletion({ userId, coinReward: 100, status: 'pending' });
      prisma.addCompletion({ userId, externalTxnId: 'b', coinReward: 60, status: 'pending' });
      prisma.addCompletion({ userId, externalTxnId: 'c', coinReward: 999, status: 'credited' });
      prisma.addCompletion({ userId, externalTxnId: 'd', coinReward: 50, status: 'rejected' });
      for (let i = 0; i < 12; i += 1) {
        prisma.addLedgerRow({
          userId,
          amount: 10 + i,
          createdAt: new Date(Date.now() - (12 - i) * 1000),
        });
      }

      const wallet = await service.walletOf(userId);

      expect(wallet.coin_balance).toBe(420);
      expect(wallet.pending_offer_credits).toBe(160); // only pending rows count
      expect(wallet.recent_ledger_entries).toHaveLength(10);
      expect(wallet.recent_ledger_entries[0].amount).toBe(21); // newest first
      expect(wallet.recent_ledger_entries[0]).toMatchObject({
        source_type: 'offer',
        balance_after: 0,
      });
    });

    it('empty wallet: zero pending, empty history', async () => {
      const wallet = await service.walletOf(userId);
      expect(wallet).toEqual({
        coin_balance: 0,
        pending_offer_credits: 0,
        recent_ledger_entries: [],
      });
    });
  });

  describe('GET /api/wallet/ledger keyset pagination on (created_at, id) DESC', () => {
    function seed(count: number): void {
      for (let i = 0; i < count; i += 1) {
        prisma.addLedgerRow({
          userId,
          amount: i + 1,
          createdAt: new Date(2026, 0, 1, 0, 0, i), // strictly increasing
        });
      }
    }

    it('walks all rows newest→oldest with no overlap and no gaps', async () => {
      seed(25);
      const seen: number[] = [];
      let cursor: string | undefined;
      let pages = 0;

      for (;;) {
        const page = await service.ledgerPage(userId, cursor, 10);
        seen.push(...page.entries.map((e) => e.amount));
        pages += 1;
        if (page.next_cursor === null) break;
        cursor = page.next_cursor;
      }

      expect(pages).toBe(3);
      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25); // no duplicates across pages
      expect(seen[0]).toBe(25); // newest first
      expect(seen[24]).toBe(1);
    });

    it('ties on created_at are broken by id DESC without losing rows', async () => {
      const sameInstant = new Date('2026-01-01T00:00:00Z');
      for (let i = 0; i < 5; i += 1) {
        prisma.addLedgerRow({ userId, amount: i + 1, createdAt: sameInstant });
      }

      const first = await service.ledgerPage(userId, undefined, 2);
      const second = await service.ledgerPage(userId, first.next_cursor ?? undefined, 2);
      const third = await service.ledgerPage(userId, second.next_cursor ?? undefined, 2);

      const ids = [...first.entries, ...second.entries, ...third.entries].map((e) => e.id);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      expect(third.next_cursor).toBeNull();
    });

    it('exact multiple of the page size ends with next_cursor null', async () => {
      seed(10);
      const page = await service.ledgerPage(userId, undefined, 10);
      expect(page.entries).toHaveLength(10);
      expect(page.next_cursor).toBeNull();
    });

    it('garbage cursor is ignored (first page returned)', async () => {
      seed(3);
      const page = await service.ledgerPage(userId, '!!!not-base64url!!!', 10);
      expect(page.entries).toHaveLength(3);
    });

    it('only the requesting user rows are visible', async () => {
      seed(2);
      prisma.addLedgerRow({ userId: prisma.addUser(randomUUID()), amount: 999 });
      const page = await service.ledgerPage(userId, undefined, 10);
      expect(page.entries.map((e) => e.amount).sort()).toEqual([1, 2]);
    });
  });

  describe('cursor codec', () => {
    it('round-trips', () => {
      const at = new Date('2026-07-19T01:02:03.456Z');
      const decoded = decodeCursor(encodeCursor(at, 'row-id'));
      expect(decoded).toEqual({ createdAt: at, id: 'row-id' });
    });

    it('rejects malformed input', () => {
      expect(decodeCursor('garbage')).toBeNull();
      expect(decodeCursor(Buffer.from('no-separator').toString('base64url'))).toBeNull();
      expect(decodeCursor(Buffer.from('not-a-date|id').toString('base64url'))).toBeNull();
    });
  });
});
