import { randomUUID } from 'node:crypto';
import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MockFcmDriver } from './fcm-driver';
import { NotificationService } from './notification.service';

interface FakeNotif {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}

class FakeNotifPrisma {
  notifs: FakeNotif[] = [];
  tokens: Array<{ userId: string; token: string }> = [];
  private seq = 0;

  readonly notification = {
    create: (args: { data: { userId: string; type: string; title: string; body: string } }) => {
      const row: FakeNotif = {
        id: randomUUID(),
        readAt: null,
        createdAt: new Date(Date.now() + this.seq++),
        ...args.data,
      };
      this.notifs.push(row);
      return Promise.resolve({ ...row });
    },
    findMany: (args: { where: { userId: string }; take: number }) => {
      const rows = this.notifs
        .filter((n) => n.userId === args.where.userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, args.take);
      return Promise.resolve(rows.map((r) => ({ ...r })));
    },
    count: (args: { where: { userId: string; readAt: null } }) =>
      Promise.resolve(
        this.notifs.filter((n) => n.userId === args.where.userId && n.readAt === null).length,
      ),
    updateMany: (args: {
      where: { id: string; userId: string; readAt: null };
      data: { readAt: Date };
    }) => {
      let count = 0;
      for (const n of this.notifs) {
        if (n.id === args.where.id && n.userId === args.where.userId && n.readAt === null) {
          n.readAt = args.data.readAt;
          count++;
        }
      }
      return Promise.resolve({ count });
    },
  };

  readonly fcmToken = {
    findMany: (args: { where: { userId: string } }) =>
      Promise.resolve(this.tokens.filter((t) => t.userId === args.where.userId).map((t) => ({ token: t.token }))),
    upsert: (args: { where: { token: string }; update: { userId: string }; create: { userId: string; token: string } }) => {
      const existing = this.tokens.find((t) => t.token === args.where.token);
      if (existing) existing.userId = args.update.userId;
      else this.tokens.push({ userId: args.create.userId, token: args.create.token });
      return Promise.resolve({});
    },
  };
}

function build(prisma: FakeNotifPrisma, fcm: MockFcmDriver): NotificationService {
  return new NotificationService(prisma as unknown as PrismaService, fcm);
}

describe('NotificationService', () => {
  let prisma: FakeNotifPrisma;
  let fcm: MockFcmDriver;
  let service: NotificationService;
  const userId = randomUUID();

  beforeEach(() => {
    prisma = new FakeNotifPrisma();
    fcm = new MockFcmDriver();
    service = build(prisma, fcm);
  });

  it('registers a device token (idempotent on the token)', async () => {
    await service.registerToken(userId, 'tok-1');
    await service.registerToken(userId, 'tok-1');
    expect(prisma.tokens).toHaveLength(1);
  });

  it('onCredited writes an inbox row and pushes to registered tokens', async () => {
    await service.registerToken(userId, 'tok-1');
    await service.onCredited({
      userId,
      coins: 25,
      sourceType: LedgerSourceType.game,
      sourceRefId: 'ledger-1',
    });
    expect(prisma.notifs).toHaveLength(1);
    expect(prisma.notifs[0]).toMatchObject({ userId, type: 'credit_game' });
    expect(prisma.notifs[0].body).toContain('25');
    expect(fcm.sent).toHaveLength(1);
    expect(fcm.sent[0].token).toBe('tok-1');
  });

  it('a credit with no registered token still records the inbox row (no push)', async () => {
    await service.onCredited({
      userId,
      coins: 5,
      sourceType: LedgerSourceType.streak,
      sourceRefId: 'ledger-2',
    });
    expect(prisma.notifs).toHaveLength(1);
    expect(fcm.sent).toHaveLength(0);
  });

  it('redemption status change delivers an inbox row + push (approved)', async () => {
    await service.registerToken(userId, 'tok-1');
    await service.onRedemptionStatus({
      userId,
      status: 'approved',
      brand: 'amazon',
      denomination: 250,
    });
    expect(prisma.notifs[0]).toMatchObject({ userId, type: 'redemption_approved' });
    expect(fcm.sent).toHaveLength(1);
  });

  it('lists newest-first with an unread count, and markRead clears it', async () => {
    await service.notify({ userId, type: 'a', title: 'A', body: 'first' });
    await service.notify({ userId, type: 'b', title: 'B', body: 'second' });

    const page = await service.list(userId, undefined, 10);
    expect(page.notifications).toHaveLength(2);
    expect(page.notifications[0].body).toBe('second'); // newest first
    expect(page.unread_count).toBe(2);
    expect(page.notifications[0].read).toBe(false);

    await service.markRead(userId, page.notifications[0].id);
    const after = await service.list(userId, undefined, 10);
    expect(after.unread_count).toBe(1);
  });

  it('markRead is owner-scoped (cannot read another user’s notification)', async () => {
    await service.notify({ userId, type: 'a', title: 'A', body: 'x' });
    const other = randomUUID();
    await service.markRead(other, prisma.notifs[0].id);
    expect(prisma.notifs[0].readAt).toBeNull();
  });
});
