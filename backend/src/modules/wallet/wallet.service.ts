import { Injectable } from '@nestjs/common';
import { CoinLedger, OfferCompletionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';

export interface LedgerEntryView {
  id: string;
  amount: number;
  source_type: string;
  source_ref_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface WalletView {
  coin_balance: number;
  pending_offer_credits: number;
  recent_ledger_entries: LedgerEntryView[];
}

export interface LedgerPage {
  entries: LedgerEntryView[];
  /** Pass back as ?cursor= for the next page; null = no more rows. */
  next_cursor: string | null;
}

export const LEDGER_PAGE_DEFAULT_LIMIT = 20;
export const LEDGER_PAGE_MAX_LIMIT = 100;
const RECENT_ENTRIES = 10;

/**
 * TRD §3.2 — wallet reads. Balance comes from the write-through cache
 * (LedgerService.getCachedBalance — reconciled nightly against SUM(ledger));
 * history pages by keyset on (created_at, id) DESC so it stays fast at
 * thousands of rows per user (no OFFSET scans).
 */
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async walletOf(userId: string): Promise<WalletView> {
    const [coinBalance, pendingAgg, recent] = await Promise.all([
      this.ledger.getCachedBalance(userId),
      this.prisma.offerCompletion.aggregate({
        where: { userId, status: OfferCompletionStatus.pending },
        _sum: { coinReward: true },
      }),
      this.prisma.coinLedger.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECENT_ENTRIES,
      }),
    ]);

    return {
      coin_balance: coinBalance,
      pending_offer_credits: pendingAgg._sum.coinReward ?? 0,
      recent_ledger_entries: recent.map(toEntryView),
    };
  }

  async ledgerPage(userId: string, cursor?: string, limit?: number): Promise<LedgerPage> {
    const take = Math.min(Math.max(limit ?? LEDGER_PAGE_DEFAULT_LIMIT, 1), LEDGER_PAGE_MAX_LIMIT);
    const where: Prisma.CoinLedgerWhereInput = { userId };

    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      // Keyset: strictly after the cursor position in (created_at, id) DESC order.
      where.OR = [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ];
    }

    const rows = await this.prisma.coinLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1, // one extra row = "has next page"
    });

    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      entries: page.map(toEntryView),
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }
}

function toEntryView(entry: CoinLedger): LedgerEntryView {
  return {
    id: entry.id,
    amount: entry.amount,
    source_type: entry.sourceType,
    source_ref_id: entry.sourceRefId,
    balance_after: entry.balanceAfter,
    created_at: entry.createdAt.toISOString(),
  };
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.indexOf('|');
    if (sep < 0) return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (Number.isNaN(createdAt.getTime()) || id.length === 0) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
