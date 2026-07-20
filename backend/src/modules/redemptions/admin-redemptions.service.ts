import { Injectable, Logger } from '@nestjs/common';
import { GiftCard, Prisma, Redemption, RedemptionStatus, User, UserStatus } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { FulfillmentOutcome, RedemptionsService, reserveKey } from './redemptions.service';
import { canTransition } from './redemption-status';
import {
  IllegalRedemptionTransitionException,
  RedemptionNotFoundException,
} from './redemptions.errors';

export interface AdminRedemptionView {
  id: string;
  user: { id: string; email: string };
  gift_card: { id: string; brand: string; denomination: number };
  coin_amount: number;
  status: string;
  rejection_reason: string | null;
  reviewed_by_admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
  /** whether an (encrypted) code is attached — the code itself is never returned here */
  has_code: boolean;
}

export interface AdminRedemptionPage {
  redemptions: AdminRedemptionView[];
  next_cursor: string | null;
}

export interface ApproveResult {
  outcome: 'issued' | 'approved_pending' | 'held_banned_user';
  redemption: AdminRedemptionView;
  reason?: string;
}

type RedemptionFull = Redemption & { giftCard: GiftCard; user: User };

/**
 * C2.3/C2.4 + C3.3 — admin redemption review. Approve pulls a code from
 * inventory and issues it (or keeps the redemption approved + queues a retry
 * when out of stock — never dropped). Reject reverses the reserved debit with a
 * compensating ledger row. Banned users can't be auto-issued (gap P6). Every
 * mutation writes an audit row in the same transaction as its status effect.
 */
@Injectable()
export class AdminRedemptionsService {
  private readonly logger = new Logger(AdminRedemptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly redemptions: RedemptionsService,
  ) {}

  async approve(adminId: string, redemptionId: string): Promise<ApproveResult> {
    const redemption = await this.load(redemptionId);

    if (redemption.status === RedemptionStatus.issued) {
      return { outcome: 'issued', redemption: toAdminView(redemption) };
    }
    if (redemption.status === RedemptionStatus.rejected) {
      throw new IllegalRedemptionTransitionException(redemption.status, RedemptionStatus.approved);
    }

    // Gap P6: a user banned after requesting is never auto-issued. Force a hold.
    if (redemption.user.status === UserStatus.banned) {
      await this.prisma.$transaction(async (tx) => {
        await tx.redemption.updateMany({
          where: {
            id: redemptionId,
            status: {
              in: [
                RedemptionStatus.requested,
                RedemptionStatus.under_review,
                RedemptionStatus.approved,
              ],
            },
          },
          data: { status: RedemptionStatus.under_review, reviewedByAdminId: adminId },
        });
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.REDEMPTION_HELD_BANNED,
          targetType: 'redemption',
          targetId: redemptionId,
          reason: 'user banned — held for manual review, not issued',
        });
      });
      const held = await this.load(redemptionId);
      return {
        outcome: 'held_banned_user',
        redemption: toAdminView(held),
        reason: 'user is banned',
      };
    }

    // Move requested/under_review → approved (idempotent if already approved).
    if (
      redemption.status === RedemptionStatus.requested ||
      redemption.status === RedemptionStatus.under_review
    ) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.redemption.updateMany({
          where: {
            id: redemptionId,
            status: { in: [RedemptionStatus.requested, RedemptionStatus.under_review] },
          },
          data: { status: RedemptionStatus.approved, reviewedByAdminId: adminId },
        });
        if (updated.count === 1) {
          await writeAuditLog(tx, {
            adminId,
            action: AUDIT_ACTIONS.REDEMPTION_APPROVED,
            targetType: 'redemption',
            targetId: redemptionId,
          });
        }
      });
    }

    // Fulfil: issue a code now, or keep approved + queue a retry.
    const outcome: FulfillmentOutcome = await this.redemptions.attemptFulfillment(
      redemptionId,
      adminId,
    );
    const fresh = await this.load(redemptionId);
    if (outcome.status === 'issued') {
      return { outcome: 'issued', redemption: toAdminView(fresh) };
    }
    return {
      outcome: 'approved_pending',
      redemption: toAdminView(fresh),
      reason: outcome.reason,
    };
  }

  async reject(
    adminId: string,
    redemptionId: string,
    reason: string,
  ): Promise<AdminRedemptionView> {
    const redemption = await this.load(redemptionId);
    if (!canTransition(redemption.status, RedemptionStatus.rejected)) {
      throw new IllegalRedemptionTransitionException(redemption.status, RedemptionStatus.rejected);
    }

    // Reverse the reserved debit first (idempotent by key). The status flip +
    // audit + notification then commit atomically; a retry is safe because the
    // reversal key can't double-refund.
    const reserveEntry = await this.prisma.coinLedger.findUnique({
      where: { idempotencyKey: reserveKey(redemptionId) },
    });
    if (reserveEntry) {
      await this.ledger.reverse(reserveEntry.id, `${reserveKey(redemptionId)}:reversal`);
    } else {
      this.logger.error(`reject: no reserve ledger row for redemption ${redemptionId}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.redemption.updateMany({
        where: {
          id: redemptionId,
          status: { in: [RedemptionStatus.requested, RedemptionStatus.under_review] },
        },
        data: {
          status: RedemptionStatus.rejected,
          rejectionReason: reason,
          reviewedByAdminId: adminId,
          resolvedAt: new Date(),
        },
      });
      if (updated.count === 1) {
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.REDEMPTION_REJECTED,
          targetType: 'redemption',
          targetId: redemptionId,
          reason,
        });
        await tx.notification.create({
          data: {
            userId: redemption.userId,
            type: 'redemption_rejected',
            title: 'Redemption rejected',
            body: `Your redemption was rejected: ${reason}. The coins have been returned to your wallet.`,
          },
        });
      }
    });

    return toAdminView(await this.load(redemptionId));
  }

  /** C3.3 — review queue, keyset-paginated, optional status filter. */
  async queue(
    status: RedemptionStatus | undefined,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<AdminRedemptionPage> {
    const take = Math.min(Math.max(limit ?? 25, 1), 100);
    const where: Prisma.RedemptionWhereInput = status ? { status } : {};
    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      where.OR = [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ];
    }
    const rows = await this.prisma.redemption.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      include: { giftCard: true, user: true },
    });
    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      redemptions: page.map(toAdminView),
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /** C3.3 — payout CSV export (no codes/PII beyond email, per Data & Security §2). */
  async exportCsv(status: RedemptionStatus | undefined): Promise<string> {
    const rows = await this.prisma.redemption.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }],
      include: { giftCard: true, user: true },
      take: 50_000,
    });
    const header = [
      'redemption_id',
      'user_id',
      'email',
      'brand',
      'denomination',
      'coin_amount',
      'status',
      'created_at',
      'resolved_at',
      'rejection_reason',
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.userId,
          r.user.email,
          r.giftCard.brand,
          String(r.giftCard.denomination),
          String(r.coinAmount),
          r.status,
          r.createdAt.toISOString(),
          r.resolvedAt ? r.resolvedAt.toISOString() : '',
          r.rejectionReason ?? '',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  private async load(redemptionId: string): Promise<RedemptionFull> {
    let redemption: RedemptionFull | null = null;
    try {
      redemption = await this.prisma.redemption.findUnique({
        where: { id: redemptionId },
        include: { giftCard: true, user: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new RedemptionNotFoundException(); // malformed uuid
      }
      throw err;
    }
    if (!redemption) {
      throw new RedemptionNotFoundException();
    }
    return redemption;
  }
}

function toAdminView(r: RedemptionFull): AdminRedemptionView {
  return {
    id: r.id,
    user: { id: r.user.id, email: r.user.email },
    gift_card: { id: r.giftCard.id, brand: r.giftCard.brand, denomination: r.giftCard.denomination },
    coin_amount: r.coinAmount,
    status: r.status,
    rejection_reason: r.rejectionReason,
    reviewed_by_admin_id: r.reviewedByAdminId,
    created_at: r.createdAt.toISOString(),
    resolved_at: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    has_code: r.giftCardCode !== null,
  };
}

/** RFC-4180-ish CSV quoting: wrap in quotes and double internal quotes when needed. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
