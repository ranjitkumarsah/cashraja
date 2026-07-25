import { randomUUID } from 'node:crypto';
import { FeedbackStatus, FeedbackType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedbackService } from './feedback.service';

interface FakeFeedbackRow {
  id: string;
  userId: string;
  type: FeedbackType;
  subject: string;
  message: string;
  status: FeedbackStatus;
  adminReply: string | null;
  resolvedByAdminId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

class FakeFeedbackPrisma {
  rows: FakeFeedbackRow[] = [];
  private clock = 0;

  readonly feedback = {
    create: (args: {
      data: { userId: string; type: FeedbackType; subject: string; message: string };
    }) => {
      const row: FakeFeedbackRow = {
        id: randomUUID(),
        userId: args.data.userId,
        type: args.data.type,
        subject: args.data.subject,
        message: args.data.message,
        status: FeedbackStatus.open,
        adminReply: null,
        resolvedByAdminId: null,
        createdAt: new Date(Date.now() + this.clock++),
        resolvedAt: null,
      };
      this.rows.push(row);
      return Promise.resolve({ ...row });
    },
    findMany: (args: { where: { userId: string } }) =>
      Promise.resolve(
        this.rows
          .filter((r) => r.userId === args.where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => ({ ...r })),
      ),
  };
}

describe('FeedbackService', () => {
  let prisma: FakeFeedbackPrisma;
  let service: FeedbackService;

  beforeEach(() => {
    prisma = new FakeFeedbackPrisma();
    service = new FeedbackService(prisma as unknown as PrismaService);
  });

  it('submits a feedback row with open status and no reply', async () => {
    const view = await service.submit('user-1', {
      type: FeedbackType.complaint,
      subject: 'Missing coins',
      message: 'My offer did not credit.',
    });

    expect(view).toMatchObject({
      type: 'complaint',
      subject: 'Missing coins',
      status: 'open',
      admin_reply: null,
      resolved_at: null,
    });
    expect(prisma.rows).toHaveLength(1);
  });

  it('lists only the caller’s own submissions, newest first', async () => {
    await service.submit('user-1', { type: FeedbackType.feedback, subject: 'A', message: 'first' });
    await service.submit('user-2', { type: FeedbackType.feedback, subject: 'B', message: 'other' });
    await service.submit('user-1', { type: FeedbackType.feedback, subject: 'C', message: 'third' });

    const mine = await service.listMine('user-1');
    expect(mine).toHaveLength(2);
    expect(mine.map((m) => m.subject)).toEqual(['C', 'A']);
  });
});
