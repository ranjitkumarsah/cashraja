import { randomUUID } from 'node:crypto';
import { AdminRole, UserStatus } from '@prisma/client';
import { ROLES_KEY } from '../../common/auth';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MockFcmDriver } from '../notifications/fcm-driver';
import { NotificationService } from '../notifications/notification.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';

interface FakeUser {
  id: string;
  status: UserStatus;
}
interface FakeInbox {
  userId: string;
  type: string;
  title: string;
  body: string;
}
interface FakeBroadcast {
  id: string;
  title: string;
  body: string;
  audienceType: string;
  targetCount: number;
  sentByAdminId: string;
  createdAt: Date;
}
interface FakeAudit {
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
}

class FakeBroadcastPrisma {
  users: FakeUser[] = [];
  inbox: FakeInbox[] = [];
  broadcasts: FakeBroadcast[] = [];
  audits: FakeAudit[] = [];
  tokens: Array<{ userId: string; token: string }> = [];

  seedUser(status: UserStatus = UserStatus.active): FakeUser {
    const u: FakeUser = { id: randomUUID(), status };
    this.users.push(u);
    return u;
  }

  readonly user = {
    findMany: (args: {
      where: { status?: UserStatus; id?: { in: string[] } };
      select?: unknown;
    }) => {
      let rows = this.users;
      if (args.where.status) rows = rows.filter((u) => u.status === args.where.status);
      if (args.where.id?.in) {
        const set = new Set(args.where.id.in);
        rows = rows.filter((u) => set.has(u.id));
      }
      return Promise.resolve(rows.map((u) => ({ id: u.id })));
    },
  };

  readonly notificationBroadcast = {
    create: (args: {
      data: {
        title: string;
        body: string;
        audienceType: string;
        targetCount: number;
        sentByAdminId: string;
      };
    }) => {
      const row: FakeBroadcast = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.broadcasts.push(row);
      return Promise.resolve({ ...row });
    },
    findMany: (_args: unknown) =>
      Promise.resolve(
        [...this.broadcasts]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((b) => ({ ...b, sentBy: { email: 'ops@cashraja.app' } })),
      ),
  };

  readonly notification = {
    createMany: (args: { data: FakeInbox[] }) => {
      this.inbox.push(...args.data);
      return Promise.resolve({ count: args.data.length });
    },
  };

  readonly adminAuditLog = {
    create: (args: { data: FakeAudit }) => {
      this.audits.push(args.data);
      return Promise.resolve({});
    },
  };

  readonly fcmToken = {
    findMany: (args: { where: { userId: { in: string[] } } }) => {
      const set = new Set(args.where.userId.in);
      return Promise.resolve(
        this.tokens.filter((t) => set.has(t.userId)).map((t) => ({ token: t.token })),
      );
    },
    deleteMany: (args: { where: { token: { in: string[] } } }) => {
      const set = new Set(args.where.token.in);
      const before = this.tokens.length;
      this.tokens = this.tokens.filter((t) => !set.has(t.token));
      return Promise.resolve({ count: before - this.tokens.length });
    },
  };

  $transaction<T>(cb: (tx: this) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

function build(prisma: FakeBroadcastPrisma, fcm: MockFcmDriver): AdminNotificationsService {
  const notifications = new NotificationService(prisma as unknown as PrismaService, fcm);
  return new AdminNotificationsService(prisma as unknown as PrismaService, notifications);
}

describe('AdminNotificationsService', () => {
  let prisma: FakeBroadcastPrisma;
  let fcm: MockFcmDriver;
  let service: AdminNotificationsService;
  const adminId = randomUUID();

  beforeEach(() => {
    prisma = new FakeBroadcastPrisma();
    fcm = new MockFcmDriver();
    service = build(prisma, fcm);
  });

  it('broadcast to all active users creates one inbox row per user + pushes to their tokens', async () => {
    const u1 = prisma.seedUser();
    const u2 = prisma.seedUser();
    prisma.seedUser(UserStatus.banned); // excluded from "all"
    prisma.tokens.push({ userId: u1.id, token: 'tok-1' });
    prisma.tokens.push({ userId: u2.id, token: 'tok-2' });

    const { broadcast } = await service.broadcast(adminId, {
      title: 'New game live!',
      body: 'Play now to earn coins.',
      audience: { type: 'all' },
    });

    expect(broadcast.audience_type).toBe('all');
    expect(broadcast.target_count).toBe(2);
    expect(prisma.inbox).toHaveLength(2);
    expect(prisma.inbox.every((n) => n.type === 'broadcast')).toBe(true);
    // push multicast reached both registered tokens
    expect(fcm.sent.map((m) => m.token).sort()).toEqual(['tok-1', 'tok-2']);
    // history + audit recorded
    expect(prisma.broadcasts).toHaveLength(1);
    expect(prisma.audits[0]).toMatchObject({
      adminId,
      action: 'notification_broadcast_sent',
      targetId: broadcast.id,
    });
  });

  it('broadcast to specific users targets only those users', async () => {
    const u1 = prisma.seedUser();
    const u2 = prisma.seedUser();
    const u3 = prisma.seedUser();
    prisma.tokens.push({ userId: u1.id, token: 'tok-1' });
    prisma.tokens.push({ userId: u3.id, token: 'tok-3' });

    const { broadcast } = await service.broadcast(adminId, {
      title: 'Thanks!',
      body: 'A little something for you.',
      audience: { type: 'users', user_ids: [u1.id, u3.id] },
    });

    expect(broadcast.target_count).toBe(2);
    expect(prisma.inbox.map((n) => n.userId).sort()).toEqual([u1.id, u3.id].sort());
    expect(prisma.inbox.some((n) => n.userId === u2.id)).toBe(false);
    expect(fcm.sent.map((m) => m.token).sort()).toEqual(['tok-1', 'tok-3']);
  });

  it('drops unknown user ids from a specific-users broadcast', async () => {
    const u1 = prisma.seedUser();
    const ghost = randomUUID();

    const { broadcast } = await service.broadcast(adminId, {
      title: 'Hi',
      body: 'there',
      audience: { type: 'users', user_ids: [u1.id, ghost] },
    });

    expect(broadcast.target_count).toBe(1);
    expect(prisma.inbox).toHaveLength(1);
    expect(prisma.inbox[0].userId).toBe(u1.id);
  });

  it('history returns broadcasts newest-first with sender email', async () => {
    prisma.seedUser();
    await service.broadcast(adminId, {
      title: 'One',
      body: 'first',
      audience: { type: 'all' },
    });
    const { broadcasts } = await service.history();
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]).toMatchObject({ title: 'One', sent_by_admin_email: 'ops@cashraja.app' });
  });

  it('is RBAC-gated to super_admin at the controller', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminNotificationsController) as AdminRole[];
    expect(roles).toEqual([AdminRole.super_admin]);
  });
});
