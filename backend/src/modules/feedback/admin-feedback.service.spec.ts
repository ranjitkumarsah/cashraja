import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FeedbackStatus, FeedbackType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminFeedbackService } from './admin-feedback.service';

interface FakeUserRow {
  id: string;
  email: string;
  displayName: string;
}

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

interface FakeAuditRow {
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
}

class FakeAdminFeedbackPrisma {
  rows: FakeFeedbackRow[] = [];
  users = new Map<string, FakeUserRow>();
  audits: FakeAuditRow[] = [];

  seedUser(): FakeUserRow {
    const u: FakeUserRow = {
      id: randomUUID(),
      email: `u-${randomUUID().slice(0, 6)}@test.local`,
      displayName: 'Fan',
    };
    this.users.set(u.id, u);
    return u;
  }

  seedFeedback(userId: string, status: FeedbackStatus = FeedbackStatus.open): FakeFeedbackRow {
    const row: FakeFeedbackRow = {
      id: randomUUID(),
      userId,
      type: FeedbackType.feedback,
      subject: 'Great app',
      message: 'Loving it',
      status,
      adminReply: null,
      resolvedByAdminId: null,
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.rows.push(row);
    return row;
  }

  private withUser(row: FakeFeedbackRow) {
    const user = this.users.get(row.userId)!;
    return { ...row, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  readonly feedback = {
    findMany: (args: { where: { status?: FeedbackStatus } }) =>
      Promise.resolve(
        this.rows
          .filter((r) => !args.where.status || r.status === args.where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => this.withUser(r)),
      ),
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.rows.find((r) => r.id === args.where.id) ?? null),
    update: (args: {
      where: { id: string };
      data: Partial<FakeFeedbackRow>;
      include?: unknown;
    }) => {
      const row = this.rows.find((r) => r.id === args.where.id)!;
      Object.assign(row, args.data);
      return Promise.resolve(this.withUser(row));
    },
  };

  readonly adminAuditLog = {
    create: (args: { data: FakeAuditRow }) => {
      this.audits.push(args.data);
      return Promise.resolve({ ...args.data });
    },
  };

  $transaction<T>(fn: (tx: FakeAdminFeedbackPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

describe('AdminFeedbackService', () => {
  let prisma: FakeAdminFeedbackPrisma;
  let service: AdminFeedbackService;

  beforeEach(() => {
    prisma = new FakeAdminFeedbackPrisma();
    service = new AdminFeedbackService(prisma as unknown as PrismaService);
  });

  it('lists submissions with the submitting user, filtered by status', async () => {
    const user = prisma.seedUser();
    prisma.seedFeedback(user.id, FeedbackStatus.open);
    prisma.seedFeedback(user.id, FeedbackStatus.resolved);

    const open = await service.list(FeedbackStatus.open);
    expect(open).toHaveLength(1);
    expect(open[0].user.email).toBe(user.email);
    expect(open[0].status).toBe('open');

    const all = await service.list(undefined);
    expect(all).toHaveLength(2);
  });

  it('reply sets the admin reply, moves open → in_review, and audits', async () => {
    const user = prisma.seedUser();
    const fb = prisma.seedFeedback(user.id, FeedbackStatus.open);

    const view = await service.reply('admin-1', fb.id, 'We are looking into it.');

    expect(view.admin_reply).toBe('We are looking into it.');
    expect(view.status).toBe('in_review');
    expect(prisma.audits).toHaveLength(1);
    expect(prisma.audits[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'feedback_replied',
      targetType: 'feedback',
      targetId: fb.id,
    });
  });

  it('resolve marks resolved with the admin id + timestamp, and audits', async () => {
    const user = prisma.seedUser();
    const fb = prisma.seedFeedback(user.id, FeedbackStatus.in_review);

    const view = await service.resolve('admin-2', fb.id);

    expect(view.status).toBe('resolved');
    expect(view.resolved_by_admin_id).toBe('admin-2');
    expect(view.resolved_at).not.toBeNull();
    expect(prisma.audits[0]).toMatchObject({ action: 'feedback_resolved', targetId: fb.id });
  });

  it('reply on a missing row throws NotFound', async () => {
    await expect(service.reply('admin-1', randomUUID(), 'hi')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolving an already-resolved row is a conflict', async () => {
    const user = prisma.seedUser();
    const fb = prisma.seedFeedback(user.id, FeedbackStatus.resolved);
    await expect(service.resolve('admin-1', fb.id)).rejects.toBeInstanceOf(ConflictException);
  });
});
