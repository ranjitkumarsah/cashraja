import { Injectable } from '@nestjs/common';
import { Feedback, FeedbackType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** A user's own view of one of their submissions. */
export interface FeedbackView {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface CreateFeedbackParams {
  type: FeedbackType;
  subject: string;
  message: string;
}

/**
 * H4 — user-facing feedback/complaint intake. Users submit rows and read back
 * their own submissions (with status + any admin reply). Admin triage lives in
 * AdminFeedbackService.
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, params: CreateFeedbackParams): Promise<FeedbackView> {
    const row = await this.prisma.feedback.create({
      data: {
        userId,
        type: params.type,
        subject: params.subject,
        message: params.message,
      },
    });
    return toFeedbackView(row);
  }

  async listMine(userId: string): Promise<FeedbackView[]> {
    const rows = await this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(toFeedbackView);
  }
}

export function toFeedbackView(row: Feedback): FeedbackView {
  return {
    id: row.id,
    type: row.type,
    subject: row.subject,
    message: row.message,
    status: row.status,
    admin_reply: row.adminReply,
    created_at: row.createdAt.toISOString(),
    resolved_at: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}
