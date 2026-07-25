import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LedgerSourceType,
  ManualOffer,
  ManualOfferSubmission,
  ManualOfferSubmissionStatus,
} from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';
import { ReferralService } from '../referral/referral.service';

/** Admin/reviewer view of a submission — includes the user and the offer. */
export interface AdminSubmissionView {
  id: string;
  offer: { id: string; title: string; coin_reward: number };
  user: { id: string; email: string; display_name: string };
  proof_text: string;
  status: string;
  review_reason: string | null;
  reviewed_by_admin_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type SubmissionWithRefs = ManualOfferSubmission & {
  offer: ManualOffer;
  user: { id: string; email: string; displayName: string };
};

/** Stable idempotency key for a manual-offer approval credit (never double-credits). */
export function manualOfferCreditKey(submissionId: string): string {
  return `manual_offer:${submissionId}`;
}

/**
 * H5 — reviewer/super-admin review of manual-offer proof submissions. Approval
 * credits the offer's coin_reward through LedgerService (the ONLY coin write
 * path) with a per-submission idempotency key, then fans out the referral bonus
 * and the credit notification — exactly the postback-credit shape. Rejection
 * records a mandatory reason and never credits. Both write an admin_audit_log
 * row in the same transaction as the status flip.
 */
@Injectable()
export class AdminManualOfferSubmissionsService {
  private readonly logger = new Logger(AdminManualOfferSubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly referral: ReferralService,
    @Inject(NOTIFICATION_HOOK) private readonly notifications: NotificationHook,
  ) {}

  async list(status: ManualOfferSubmissionStatus | undefined): Promise<AdminSubmissionView[]> {
    const rows = await this.prisma.manualOfferSubmission.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { offer: true, user: { select: { id: true, email: true, displayName: true } } },
      take: 500,
    });
    return rows.map(toAdminSubmissionView);
  }

  /**
   * Approve a pending submission: credit once (idempotent), flip to approved +
   * stamp reviewer, audit in the same tx, then fan out referral + notification.
   * Approving an already-approved submission is an idempotent no-op; a rejected
   * one is a conflict.
   */
  async approve(adminId: string, submissionId: string): Promise<AdminSubmissionView> {
    const submission = await this.findWithRefs(submissionId);
    if (submission.status === ManualOfferSubmissionStatus.approved) {
      return toAdminSubmissionView(submission); // idempotent
    }
    if (submission.status === ManualOfferSubmissionStatus.rejected) {
      throw new ConflictException('Submission has already been rejected');
    }

    // Single coin write path. Idempotency key is per-submission, so a duplicate
    // approve (double-click, retry) can never double-credit.
    const credit = await this.ledger.record({
      userId: submission.userId,
      amount: submission.offer.coinReward,
      sourceType: LedgerSourceType.offer,
      sourceRefId: submission.id,
      idempotencyKey: manualOfferCreditKey(submission.id),
    });

    const { view, transitioned } = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.manualOfferSubmission.updateMany({
        where: { id: submissionId, status: ManualOfferSubmissionStatus.pending },
        data: {
          status: ManualOfferSubmissionStatus.approved,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          reviewReason: null,
        },
      });
      if (flipped.count === 1) {
        await writeAuditLog(tx, {
          adminId,
          action: AUDIT_ACTIONS.MANUAL_OFFER_SUBMISSION_APPROVED,
          targetType: 'manual_offer_submission',
          targetId: submissionId,
          reason: `+${submission.offer.coinReward} coins`,
        });
      }
      const fresh = await tx.manualOfferSubmission.findUnique({
        where: { id: submissionId },
        include: { offer: true, user: { select: { id: true, email: true, displayName: true } } },
      });
      return { view: fresh!, transitioned: flipped.count === 1 };
    });

    // Post-credit fan-out (best-effort, never fails the approval). Only fire on
    // the call that actually performed the transition, so a concurrent
    // double-approve never sends a duplicate notification / referral payout.
    if (transitioned) {
      await this.notifications.onCredited({
        userId: submission.userId,
        coins: submission.offer.coinReward,
        sourceType: LedgerSourceType.offer,
        sourceRefId: submission.id,
      });
      await this.referral.onUserEarned({
        userId: submission.userId,
        amount: submission.offer.coinReward,
        sourceLedgerId: credit.entry.id,
      });
    }

    return toAdminSubmissionView(view);
  }

  /** Reject a pending submission with a mandatory reason. No credit. */
  async reject(
    adminId: string,
    submissionId: string,
    reason: string,
  ): Promise<AdminSubmissionView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.manualOfferSubmission.findUnique({ where: { id: submissionId } });
      if (!row) {
        throw new NotFoundException('Submission not found');
      }
      if (row.status !== ManualOfferSubmissionStatus.pending) {
        throw new ConflictException(`Cannot reject a submission that is ${row.status}`);
      }
      const next = await tx.manualOfferSubmission.update({
        where: { id: submissionId },
        data: {
          status: ManualOfferSubmissionStatus.rejected,
          reviewReason: reason,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
        include: { offer: true, user: { select: { id: true, email: true, displayName: true } } },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.MANUAL_OFFER_SUBMISSION_REJECTED,
        targetType: 'manual_offer_submission',
        targetId: submissionId,
        reason,
      });
      return next;
    });
    return toAdminSubmissionView(updated);
  }

  private async findWithRefs(submissionId: string): Promise<SubmissionWithRefs> {
    const row = await this.prisma.manualOfferSubmission.findUnique({
      where: { id: submissionId },
      include: { offer: true, user: { select: { id: true, email: true, displayName: true } } },
    });
    if (!row) {
      throw new NotFoundException('Submission not found');
    }
    return row;
  }
}

export function toAdminSubmissionView(row: SubmissionWithRefs): AdminSubmissionView {
  return {
    id: row.id,
    offer: { id: row.offer.id, title: row.offer.title, coin_reward: row.offer.coinReward },
    user: { id: row.user.id, email: row.user.email, display_name: row.user.displayName },
    proof_text: row.proofText,
    status: row.status,
    review_reason: row.reviewReason,
    reviewed_by_admin_id: row.reviewedByAdminId,
    created_at: row.createdAt.toISOString(),
    reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}
