import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Feedback, FeedbackStatus } from '@prisma/client';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Admin view of a submission — includes the submitting user. */
export interface AdminFeedbackView {
  id: string;
  user: { id: string; email: string; display_name: string };
  type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  resolved_by_admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

type FeedbackWithUser = Feedback & {
  user: { id: string; email: string; displayName: string };
};

/**
 * H4 — admin triage of the feedback queue. Reviewers and super-admins both view,
 * reply, and resolve (no @Roles gate beyond admin auth). Every mutation writes an
 * admin_audit_log row in the same transaction as its effect.
 */
@Injectable()
export class AdminFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status: FeedbackStatus | undefined): Promise<AdminFeedbackView[]> {
    const rows = await this.prisma.feedback.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }],
      include: { user: true },
      take: 500,
    });
    return rows.map(toAdminFeedbackView);
  }

  /** Record an admin reply. Moves an open item to in_review; never un-resolves. */
  async reply(adminId: string, feedbackId: string, reply: string): Promise<AdminFeedbackView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.feedback.findUnique({ where: { id: feedbackId } });
      if (!row) {
        throw new NotFoundException('Feedback not found');
      }
      const next = await tx.feedback.update({
        where: { id: feedbackId },
        data: {
          adminReply: reply,
          status: row.status === FeedbackStatus.open ? FeedbackStatus.in_review : row.status,
        },
        include: { user: true },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.FEEDBACK_REPLIED,
        targetType: 'feedback',
        targetId: feedbackId,
      });
      return next;
    });
    return toAdminFeedbackView(updated);
  }

  async resolve(adminId: string, feedbackId: string): Promise<AdminFeedbackView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.feedback.findUnique({ where: { id: feedbackId } });
      if (!row) {
        throw new NotFoundException('Feedback not found');
      }
      if (row.status === FeedbackStatus.resolved) {
        throw new ConflictException('Feedback is already resolved');
      }
      const next = await tx.feedback.update({
        where: { id: feedbackId },
        data: {
          status: FeedbackStatus.resolved,
          resolvedByAdminId: adminId,
          resolvedAt: new Date(),
        },
        include: { user: true },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.FEEDBACK_RESOLVED,
        targetType: 'feedback',
        targetId: feedbackId,
      });
      return next;
    });
    return toAdminFeedbackView(updated);
  }
}

export function toAdminFeedbackView(row: FeedbackWithUser): AdminFeedbackView {
  return {
    id: row.id,
    user: { id: row.user.id, email: row.user.email, display_name: row.user.displayName },
    type: row.type,
    subject: row.subject,
    message: row.message,
    status: row.status,
    admin_reply: row.adminReply,
    resolved_by_admin_id: row.resolvedByAdminId,
    created_at: row.createdAt.toISOString(),
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}
