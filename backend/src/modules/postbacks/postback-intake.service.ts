import { Inject, Injectable, Logger } from '@nestjs/common';
import { OfferCompletionStatus, OfferNetwork, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CanonicalPostback } from '../../providers/offerwall/offerwall-adapter';
import { POSTBACK_QUEUE, PostbackQueue } from './postback-queue';

export type IntakeResult =
  | { status: 'accepted'; completion_id: string }
  | { status: 'duplicate' }
  | { status: 'rejected'; reason: string };

/**
 * Sync half of the offerwall pipeline (ARCHITECTURE_PLAN §2.2 steps 2-4):
 * persist the offer_completion (status=pending) + enqueue — NO heavy work
 * inline; the 200 goes back inside the network's timeout budget.
 *
 * Duplicate delivery (network retry) hits the (network, external_txn_id)
 * unique constraint and short-circuits with 200 — but a still-pending
 * duplicate re-enqueues, so a lost job (e.g. Redis blip after the row was
 * written) self-heals on the network's next retry.
 */
@Injectable()
export class PostbackIntakeService {
  private readonly logger = new Logger(PostbackIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(POSTBACK_QUEUE) private readonly queue: PostbackQueue,
  ) {}

  async intakeOffer(network: string, postback: CanonicalPostback): Promise<IntakeResult> {
    // Hot path is a single INSERT (+ optional offer resolution): the DB is
    // the authority on both duplicates (unique network+txn ⇒ P2002) and
    // unknown users (user_id FK ⇒ P2003) — no pre-check round trips
    // (NFR §9 / B2.5 latency budget).
    const offerId = await this.resolveOfferId(network, postback.externalOfferId);

    let completionId: string;
    try {
      const completion = await this.prisma.offerCompletion.create({
        data: {
          userId: postback.networkUserId,
          offerId,
          network,
          externalTxnId: postback.externalTxnId,
          status: OfferCompletionStatus.pending,
          coinReward: postback.coins,
          networkPayload: postback.raw as Prisma.InputJsonValue,
        },
      });
      completionId = completion.id;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        const existing = await this.prisma.offerCompletion.findUnique({
          where: { network_externalTxnId: { network, externalTxnId: postback.externalTxnId } },
          select: { id: true, status: true },
        });
        if (existing?.status === OfferCompletionStatus.pending) {
          await this.queue.enqueue({ kind: 'offer', completionId: existing.id });
        }
        return { status: 'duplicate' };
      }
      if (this.isUnknownUser(err)) {
        // Permanent failure — 200 stops the network's retry storm, log keeps the trail.
        this.logger.warn(
          `[${network}] postback for unknown user "${postback.networkUserId}" (txn ${postback.externalTxnId}) — rejected`,
        );
        return { status: 'rejected', reason: 'unknown_user' };
      }
      throw err;
    }

    // Row is durable; if the enqueue throws, the 500 makes the network retry
    // and the duplicate path above re-enqueues.
    await this.queue.enqueue({ kind: 'offer', completionId });
    return { status: 'accepted', completion_id: completionId };
  }

  /** FK violation on user_id (P2003) or malformed uuid (P2023) ⇒ no such user. */
  private isUnknownUser(err: unknown): boolean {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (err.code === 'P2023') return true;
    if (err.code !== 'P2003') return false;
    const field = (err.meta as { field_name?: string } | undefined)?.field_name;
    return field === undefined || field.includes('user');
  }

  private async resolveOfferId(network: string, externalOfferId?: string): Promise<string | null> {
    if (!externalOfferId) return null;
    if (!(Object.values(OfferNetwork) as string[]).includes(network)) return null;
    const offer = await this.prisma.offer.findUnique({
      where: {
        network_externalOfferId: { network: network as OfferNetwork, externalOfferId },
      },
      select: { id: true },
    });
    return offer?.id ?? null;
  }

  private isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
