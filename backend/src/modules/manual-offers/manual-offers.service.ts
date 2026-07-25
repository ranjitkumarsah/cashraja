import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ManualOffer,
  ManualOfferSubmission,
  ManualOfferSubmissionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** An active manual offer, with the caller's own submission status (if any). */
export interface ManualOfferView {
  id: string;
  title: string;
  description: string;
  instructions: string;
  coin_reward: number;
  /** the caller's most recent submission status for this offer, or null */
  my_submission_status: string | null;
  created_at: string;
}

/** The caller's own view of one of their submissions. */
export interface MyManualOfferSubmissionView {
  id: string;
  offer_id: string;
  offer_title: string;
  coin_reward: number;
  proof_text: string;
  status: string;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

type SubmissionWithOffer = ManualOfferSubmission & { offer: ManualOffer };

/**
 * H5 — user-facing manual offers. Users list active offers (with their own
 * submission status folded in), submit free-text proof, and read back their own
 * submissions. A user may hold at most one non-rejected submission per offer.
 * Admin management + review live in the Admin* services.
 */
@Injectable()
export class ManualOffersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active offers, newest first, annotated with the caller's submission status. */
  async listForUser(userId: string): Promise<ManualOfferView[]> {
    const offers = await this.prisma.manualOffer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const submissions = await this.prisma.manualOfferSubmission.findMany({
      where: { userId, offerId: { in: offers.map((o) => o.id) } },
      orderBy: { createdAt: 'desc' },
    });
    // Most-recent submission per offer (rows are already newest-first).
    const statusByOffer = new Map<string, ManualOfferSubmissionStatus>();
    for (const s of submissions) {
      if (!statusByOffer.has(s.offerId)) statusByOffer.set(s.offerId, s.status);
    }
    return offers.map((o) => toOfferView(o, statusByOffer.get(o.id) ?? null));
  }

  /**
   * Submit text proof for an active offer. Enforces the "at most one non-rejected
   * submission per offer" rule: a pending or approved submission blocks a resubmit
   * (409); a previously rejected one may be retried.
   */
  async submit(
    userId: string,
    offerId: string,
    proofText: string,
  ): Promise<MyManualOfferSubmissionView> {
    let offer: ManualOffer | null;
    try {
      offer = await this.prisma.manualOffer.findUnique({ where: { id: offerId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new NotFoundException('Manual offer not found'); // malformed uuid
      }
      throw err;
    }
    if (!offer || !offer.isActive) {
      throw new NotFoundException('Manual offer not found');
    }

    const existing = await this.prisma.manualOfferSubmission.findFirst({
      where: {
        userId,
        offerId,
        status: { in: [ManualOfferSubmissionStatus.pending, ManualOfferSubmissionStatus.approved] },
      },
    });
    if (existing) {
      throw new ConflictException(
        existing.status === ManualOfferSubmissionStatus.approved
          ? 'You have already completed this offer'
          : 'You already have a submission pending review for this offer',
      );
    }

    const created = await this.prisma.manualOfferSubmission.create({
      data: { offerId, userId, proofText },
      include: { offer: true },
    });
    return toMySubmissionView(created);
  }

  /** The caller's own submissions across all offers, newest first. */
  async listMine(userId: string): Promise<MyManualOfferSubmissionView[]> {
    const rows = await this.prisma.manualOfferSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { offer: true },
      take: 200,
    });
    return rows.map(toMySubmissionView);
  }
}

function toOfferView(offer: ManualOffer, myStatus: ManualOfferSubmissionStatus | null): ManualOfferView {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    instructions: offer.instructions,
    coin_reward: offer.coinReward,
    my_submission_status: myStatus,
    created_at: offer.createdAt.toISOString(),
  };
}

export function toMySubmissionView(row: SubmissionWithOffer): MyManualOfferSubmissionView {
  return {
    id: row.id,
    offer_id: row.offerId,
    offer_title: row.offer.title,
    coin_reward: row.offer.coinReward,
    proof_text: row.proofText,
    status: row.status,
    review_reason: row.reviewReason,
    created_at: row.createdAt.toISOString(),
    reviewed_at: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}
