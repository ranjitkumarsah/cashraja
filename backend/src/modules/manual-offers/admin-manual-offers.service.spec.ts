import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminManualOffersService } from './admin-manual-offers.service';

interface FakeOffer {
  id: string;
  title: string;
  description: string;
  instructions: string;
  coinReward: number;
  isActive: boolean;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeAuditRow {
  adminId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
}

class FakeAdminOffersPrisma {
  offers: FakeOffer[] = [];
  audits: FakeAuditRow[] = [];

  readonly manualOffer = {
    findMany: () =>
      Promise.resolve([...this.offers].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.offers.find((o) => o.id === args.where.id) ?? null),
    create: (args: {
      data: {
        title: string;
        description: string;
        instructions: string;
        coinReward: number;
        createdByAdminId: string;
      };
    }) => {
      const offer: FakeOffer = {
        id: randomUUID(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      this.offers.push(offer);
      return Promise.resolve(offer);
    },
    update: (args: { where: { id: string }; data: Partial<FakeOffer> }) => {
      const offer = this.offers.find((o) => o.id === args.where.id)!;
      Object.assign(offer, args.data, { updatedAt: new Date() });
      return Promise.resolve(offer);
    },
  };

  readonly adminAuditLog = {
    create: (args: { data: FakeAuditRow }) => {
      this.audits.push(args.data);
      return Promise.resolve({ ...args.data });
    },
  };

  $transaction<T>(fn: (tx: FakeAdminOffersPrisma) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

describe('AdminManualOffersService', () => {
  let prisma: FakeAdminOffersPrisma;
  let service: AdminManualOffersService;

  beforeEach(() => {
    prisma = new FakeAdminOffersPrisma();
    service = new AdminManualOffersService(prisma as unknown as PrismaService);
  });

  it('creates an offer with the authoring admin and audits it', async () => {
    const view = await service.create('admin-1', {
      title: 'Join our Telegram',
      description: 'Join the channel',
      instructions: 'Tap the link and join',
      coinReward: 30,
    });

    expect(view.title).toBe('Join our Telegram');
    expect(view.coin_reward).toBe(30);
    expect(view.is_active).toBe(true);
    expect(view.created_by_admin_id).toBe('admin-1');
    expect(prisma.audits[0]).toMatchObject({
      adminId: 'admin-1',
      action: 'manual_offer_created',
      targetType: 'manual_offer',
      targetId: view.id,
    });
  });

  it('updates fields and toggles active, auditing the change', async () => {
    const created = await service.create('admin-1', {
      title: 'Old',
      description: 'd',
      instructions: 'i',
      coinReward: 10,
    });
    prisma.audits.length = 0;

    const view = await service.update('admin-2', created.id, {
      isActive: false,
      coinReward: 99,
    });

    expect(view.is_active).toBe(false);
    expect(view.coin_reward).toBe(99);
    expect(prisma.audits[0]).toMatchObject({
      adminId: 'admin-2',
      action: 'manual_offer_updated',
      targetId: created.id,
    });
    expect(prisma.audits[0].reason).toContain('is_active=false');
    expect(prisma.audits[0].reason).toContain('coin_reward=99');
  });

  it('throws NotFound updating a missing offer', async () => {
    await expect(service.update('admin-1', randomUUID(), { isActive: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
