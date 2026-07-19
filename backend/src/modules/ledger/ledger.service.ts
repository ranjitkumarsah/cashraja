import { Injectable, Logger } from '@nestjs/common';
import { CoinLedger, LedgerSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  InsufficientBalanceError,
  InvalidLedgerAmountError,
  LedgerEntryNotFoundError,
  LedgerUserNotFoundError,
} from './ledger.errors';

export interface RecordParams {
  userId: string;
  /** positive = credit, negative = debit */
  amount: number;
  sourceType: LedgerSourceType;
  sourceRefId?: string;
  idempotencyKey: string;
}

export interface ReserveDebitParams {
  userId: string;
  /** positive number of coins to reserve (stored as a negative ledger row) */
  amount: number;
  sourceType?: LedgerSourceType;
  sourceRefId?: string;
  idempotencyKey: string;
}

export interface LedgerWriteResult {
  entry: CoinLedger;
  /** true when the idempotency key already existed — no new row was written */
  duplicate: boolean;
}

interface LockedUserRow {
  id: string;
  coin_balance_cached: number;
}

/**
 * THE single write path for coins (ARCHITECTURE_PLAN §2.1).
 *
 * Every coin movement is an append-only coin_ledger row written inside a
 * transaction that:
 *   1. locks the user row (SELECT ... FOR UPDATE) to serialize concurrent writes,
 *   2. inserts the ledger row with balance_after computed under the lock,
 *   3. write-through updates users.coin_balance_cached in the same transaction.
 *
 * Idempotency is enforced by the DB unique constraint on idempotency_key:
 * a unique violation (Prisma P2002) means "already recorded" and returns the
 * existing row as a no-op — never an error, never a double-credit.
 *
 * No other module writes coin_ledger. Ever.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Record a coin movement. Credits use positive amount, debits negative. */
  async record(params: RecordParams): Promise<LedgerWriteResult> {
    const { userId, amount, sourceType, sourceRefId, idempotencyKey } = params;
    if (!Number.isInteger(amount) || amount === 0) {
      throw new InvalidLedgerAmountError(`Ledger amount must be a non-zero integer, got ${amount}`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.coinLedger.findUnique({ where: { idempotencyKey } });
        if (existing) {
          return { entry: existing, duplicate: true };
        }

        const locked = await this.lockUserRow(tx, userId);
        const balanceAfter = locked.coin_balance_cached + amount;

        const entry = await tx.coinLedger.create({
          data: {
            userId,
            amount,
            sourceType,
            sourceRefId: sourceRefId ?? null,
            idempotencyKey,
            balanceAfter,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { coinBalanceCached: balanceAfter },
        });

        return { entry, duplicate: false };
      });
    } catch (err) {
      const dup = await this.resolveIdempotencyRace(err, idempotencyKey);
      if (dup) return dup;
      throw err;
    }
  }

  /**
   * Reserve-debit (redemption reserve pattern): verifies balance >= amount under
   * the user row lock, then records a negative entry. The lock serializes
   * concurrent reserves, so two simultaneous requests can never both spend the
   * same coins — the second sees the reduced balance and fails.
   */
  async reserveDebit(params: ReserveDebitParams): Promise<LedgerWriteResult> {
    const { userId, amount, sourceRefId, idempotencyKey } = params;
    const sourceType = params.sourceType ?? LedgerSourceType.redemption;
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidLedgerAmountError(`Reserve amount must be a positive integer, got ${amount}`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.coinLedger.findUnique({ where: { idempotencyKey } });
        if (existing) {
          return { entry: existing, duplicate: true };
        }

        const locked = await this.lockUserRow(tx, userId);
        if (locked.coin_balance_cached < amount) {
          throw new InsufficientBalanceError(userId, amount, locked.coin_balance_cached);
        }
        const balanceAfter = locked.coin_balance_cached - amount;

        const entry = await tx.coinLedger.create({
          data: {
            userId,
            amount: -amount,
            sourceType,
            sourceRefId: sourceRefId ?? null,
            idempotencyKey,
            balanceAfter,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { coinBalanceCached: balanceAfter },
        });

        return { entry, duplicate: false };
      });
    } catch (err) {
      const dup = await this.resolveIdempotencyRace(err, idempotencyKey);
      if (dup) return dup;
      throw err;
    }
  }

  /**
   * Compensating reversal: appends a new entry with the opposite amount,
   * referencing the original by id. The original row is never mutated or
   * deleted (append-only invariant). Reversing a reserve-debit returns the
   * coins; reversing a credit claws it back.
   */
  async reverse(originalLedgerId: string, idempotencyKey: string): Promise<LedgerWriteResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.coinLedger.findUnique({ where: { idempotencyKey } });
        if (existing) {
          return { entry: existing, duplicate: true };
        }

        const original = await tx.coinLedger.findUnique({ where: { id: originalLedgerId } });
        if (!original) {
          throw new LedgerEntryNotFoundError(originalLedgerId);
        }

        const locked = await this.lockUserRow(tx, original.userId);
        const balanceAfter = locked.coin_balance_cached - original.amount;

        const entry = await tx.coinLedger.create({
          data: {
            userId: original.userId,
            amount: -original.amount,
            sourceType: original.sourceType,
            sourceRefId: originalLedgerId,
            idempotencyKey,
            balanceAfter,
          },
        });

        await tx.user.update({
          where: { id: original.userId },
          data: { coinBalanceCached: balanceAfter },
        });

        return { entry, duplicate: false };
      });
    } catch (err) {
      const dup = await this.resolveIdempotencyRace(err, idempotencyKey);
      if (dup) return dup;
      throw err;
    }
  }

  /** Authoritative balance: SUM over the append-only ledger. */
  async getBalance(userId: string): Promise<number> {
    const result = await this.prisma.coinLedger.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  /** Read-optimized cached balance (write-through; reconciled nightly). */
  async getCachedBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { coinBalanceCached: true },
    });
    if (!user) {
      throw new LedgerUserNotFoundError(userId);
    }
    return user.coinBalanceCached;
  }

  /**
   * Row lock on the user via SELECT ... FOR UPDATE. All ledger writers acquire
   * this lock first, so balance reads + writes inside the transaction are
   * serialized per user.
   */
  private async lockUserRow(tx: Prisma.TransactionClient, userId: string): Promise<LockedUserRow> {
    const rows = await tx.$queryRaw<LockedUserRow[]>`
      SELECT id, coin_balance_cached FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (!row) {
      throw new LedgerUserNotFoundError(userId);
    }
    return row;
  }

  /**
   * Unique-violation on idempotency_key lost a race with a concurrent insert:
   * fetch and return the winning row as a duplicate no-op. Any other error
   * returns null so the caller rethrows.
   */
  private async resolveIdempotencyRace(
    err: unknown,
    idempotencyKey: string,
  ): Promise<LedgerWriteResult | null> {
    if (!this.isIdempotencyKeyViolation(err)) {
      return null;
    }
    const entry = await this.prisma.coinLedger.findUnique({ where: { idempotencyKey } });
    if (!entry) {
      // Should be unreachable: the row that caused the violation vanished.
      this.logger.error(`P2002 on idempotency_key "${idempotencyKey}" but no row found`);
      return null;
    }
    return { entry, duplicate: true };
  }

  private isIdempotencyKeyViolation(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
      return false;
    }
    const target = (err.meta as { target?: string[] | string } | undefined)?.target;
    if (target === undefined) return true; // driver did not report the column set
    const targets = Array.isArray(target) ? target : [target];
    return targets.some((t) => t.includes('idempotency'));
  }
}
