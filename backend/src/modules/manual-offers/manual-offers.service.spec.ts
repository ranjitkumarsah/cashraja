import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ManualOfferSubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ManualOffersService } from './manual-offers.service';

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

interface FakeSubmission {
  id: string;
  offerId: string;
  userId: string;
  proofText: string;
  status: ManualOfferSubmissionStatus;
  reviewReason: string | null;
  reviewedByAdminId: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

class FakeManualOffersPrisma {
  offers: FakeOffer[] = [];
  submissions: FakeSubmission[] = [];
  private clock = 0;

  seedOffer(partial: Partial<FakeOffer> = {}): FakeOffer {
    const offer: FakeOffer = {
      id: randomUUID(),
      title: 'Follow us on X',
      description: 'Follow @cashraja',
      instructions: 'Follow and screenshot',
      coinReward: 50,
      isActive: true,
      createdByAdminId: randomUUID(),
      createdAt: new Date(Date.now() + this.clock++),
      updatedAt: new Date(),
      ...partial,
    };
    this.offers.push(offer);
    return offer;
  }

  seedSubmission(partial: Partial<FakeSubmission> & { offerId: string; userId: string }): FakeSubmission {
    const sub: FakeSubmission = {
      id: randomUUID(),
      proofText: 'done',
      status: ManualOfferSubmissionStatus.pending,
      reviewReason: null,
      reviewedByAdminId: null,
      createdAt: new Date(Date.now() + this.clock++),
      reviewedAt: null,
      ...partial,
    };
    this.submissions.push(sub);
    return sub;
  }

  readonly manualOffer = {
    findMany: (args: { where?: { isActive?: boolean } }) =>
      Promise.resolve(
        this.offers
          .filter((o) => args.where?.isActive === undefined || o.isActive === args.where.isActive)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
    findUnique: (args: { where: { id: string } }) =>
      Promise.resolve(this.offers.find((o) => o.id === args.where.id) ?? null),
  };

  readonly manualOfferSubmission = {
    findMany: (args: { where: { userId: string; offerId?: { in: string[] } } }) =>
      Promise.resolve(
        this.submissions
          .filter((s) => s.userId === args.where.userId)
          .filter((s) => !args.where.offerId || args.where.offerId.in.includes(s.offerId))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((s) => ({ ...s, offer: this.offers.find((o) => o.id === s.offerId)! })),
      ),
    findFirst: (args: {
      where: { userId: string; offerId: string; status?: { in: ManualOfferSubmissionStatus[] } };
    }) =>
      Promise.resolve(
        this.submissions.find(
          (s) =>
            s.userId === args.where.userId &&
            s.offerId === args.where.offerId &&
            (!args.where.status || args.where.status.in.includes(s.status)),
        ) ?? null,
      ),
    create: (args: { data: { offerId: string; userId: string; proofText: string } }) => {
      const created = this.seedSubmission({ ...args.data });
      return Promise.resolve({ ...created, offer: this.offers.find((o) => o.id === created.offerId)! });
    },
  };
}

describe('ManualOffersService', () => {
  let prisma: FakeManualOffersPrisma;
  let service: ManualOffersService;

  beforeEach(() => {
    prisma = new FakeManualOffersPrisma();
    service = new ManualOffersService(prisma as unknown as PrismaService);
  });

  it('lists only active offers, annotated with the caller`s submission status', async () => {
    const userId = randomUUID();
    const active = prisma.seedOffer({ title: 'Active' });
    prisma.seedOffer({ title: 'Disabled', isActive: false });
    prisma.seedSubmission({
      offerId: active.id,
      userId,
      status: ManualOfferSubmissionStatus.pending,
    });

    const list = await service.listForUser(userId);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Active');
    expect(list[0].my_submission_status).toBe('pending');
  });

  it('shows null submission status for offers the caller has not submitted to', async () => {
    prisma.seedOffer();
    const list = await service.listForUser(randomUUID());
    expect(list[0].my_submission_status).toBeNull();
  });

  it('accepts a proof submission for an active offer', async () => {
    const offer = prisma.seedOffer();
    const view = await service.submit(randomUUID(), offer.id, 'here is my proof');
    expect(view.status).toBe('pending');
    expect(view.proof_text).toBe('here is my proof');
    expect(view.offer_title).toBe(offer.title);
    expect(view.coin_reward).toBe(offer.coinReward);
  });

  it('rejects a submission for an unknown or inactive offer', async () => {
    const disabled = prisma.seedOffer({ isActive: false });
    await expect(service.submit(randomUUID(), disabled.id, 'proof')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.submit(randomUUID(), randomUUID(), 'proof')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('enforces at most one non-rejected submission per offer (pending blocks resubmit)', async () => {
    const userId = randomUUID();
    const offer = prisma.seedOffer();
    await service.submit(userId, offer.id, 'first');
    await expect(service.submit(userId, offer.id, 'second')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks resubmitting to an already-approved offer', async () => {
    const userId = randomUUID();
    const offer = prisma.seedOffer();
    prisma.seedSubmission({
      offerId: offer.id,
      userId,
      status: ManualOfferSubmissionStatus.approved,
    });
    await expect(service.submit(userId, offer.id, 'again')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('allows resubmitting after a rejection', async () => {
    const userId = randomUUID();
    const offer = prisma.seedOffer();
    prisma.seedSubmission({
      offerId: offer.id,
      userId,
      status: ManualOfferSubmissionStatus.rejected,
    });
    const view = await service.submit(userId, offer.id, 'trying again');
    expect(view.status).toBe('pending');
  });

  it('returns the caller`s own submissions newest-first', async () => {
    const userId = randomUUID();
    const offer = prisma.seedOffer();
    prisma.seedSubmission({ offerId: offer.id, userId, status: ManualOfferSubmissionStatus.rejected, reviewReason: 'blurry' });
    const mine = await service.listMine(userId);
    expect(mine).toHaveLength(1);
    expect(mine[0].review_reason).toBe('blurry');
  });
});
