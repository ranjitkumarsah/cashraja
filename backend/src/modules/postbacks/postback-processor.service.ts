import { Inject, Injectable, Logger } from '@nestjs/common';
import { LedgerSourceType, OfferCompletionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FRAUD_CHECK_SERVICE, FraudCheckService } from '../fraud/fraud-check.service';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';
import { PostbackJobData } from './postback-queue';

/**
 * Async half of the postback pipeline (ARCHITECTURE_PLAN §2.2 steps 5-8):
 * fraud pre-check → LedgerService.record → status flip → notification hook.
 *
 * Fully idempotent: re-processing a credited completion / impression is a
 * no-op (status short-circuit + DB idempotency key), so at-least-once job
 * delivery can never double-credit.
 */
@Injectable()
export class PostbackProcessorService {
  private readonly logger = new Logger(PostbackProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(FRAUD_CHECK_SERVICE) private readonly fraud: FraudCheckService,
    @Inject(NOTIFICATION_HOOK) private readonly notifications: NotificationHook,
  ) {}

  async process(data: PostbackJobData): Promise<void> {
    if (data.kind === 'offer') {
      await this.processOfferCompletion(data.completionId);
    } else {
      await this.processAdImpression(data.impressionId);
    }
  }

  private async processOfferCompletion(completionId: string): Promise<void> {
    const completion = await this.prisma.offerCompletion.findUnique({
      where: { id: completionId },
    });
    if (!completion) {
      this.logger.warn(`offer job for missing completion ${completionId} — skipped`);
      return;
    }
    if (completion.status !== OfferCompletionStatus.pending) {
      return; // already credited or rejected — idempotent no-op
    }
    if (completion.coinReward <= 0) {
      await this.prisma.offerCompletion.updateMany({
        where: { id: completion.id, status: OfferCompletionStatus.pending },
        data: { status: OfferCompletionStatus.rejected, statusReason: 'invalid_amount' },
      });
      return;
    }

    const verdict = await this.fraud.checkCredit({
      userId: completion.userId,
      sourceType: 'offer',
      network: completion.network,
      externalTxnId: completion.externalTxnId,
      coins: completion.coinReward,
    });
    if (verdict.verdict === 'hold') {
      // Credit held: stays pending with the flag reason stored for the
      // Phase C/E review queue. No ledger write.
      await this.prisma.offerCompletion.updateMany({
        where: { id: completion.id, status: OfferCompletionStatus.pending },
        data: { statusReason: `hold:${verdict.reason}` },
      });
      this.logger.warn(`completion ${completion.id} held by fraud pre-check: ${verdict.reason}`);
      return;
    }

    // Idempotency key convention: `${network}:${externalTxnId}` (TRD §3.5).
    await this.ledger.record({
      userId: completion.userId,
      amount: completion.coinReward,
      sourceType: LedgerSourceType.offer,
      sourceRefId: completion.id,
      idempotencyKey: `${completion.network}:${completion.externalTxnId}`,
    });

    await this.prisma.offerCompletion.updateMany({
      where: { id: completion.id, status: OfferCompletionStatus.pending },
      data: {
        status: OfferCompletionStatus.credited,
        creditedAt: new Date(),
        statusReason: null,
      },
    });

    await this.notifications.onCredited({
      userId: completion.userId,
      coins: completion.coinReward,
      sourceType: LedgerSourceType.offer,
      sourceRefId: completion.id,
    });
  }

  private async processAdImpression(impressionId: string): Promise<void> {
    const impression = await this.prisma.adImpression.findUnique({ where: { id: impressionId } });
    if (!impression) {
      this.logger.warn(`ad job for missing impression ${impressionId} — skipped`);
      return;
    }
    if (!impression.verified || impression.coinReward <= 0) {
      return; // capped / unverified impressions never credit
    }

    const externalTxnId = this.externalTxnIdOf(impression.ssvPayload) ?? impression.id;
    const verdict = await this.fraud.checkCredit({
      userId: impression.userId,
      sourceType: 'ad',
      network: impression.network,
      externalTxnId,
      coins: impression.coinReward,
    });
    if (verdict.verdict === 'hold') {
      this.logger.warn(`ad impression ${impression.id} held by fraud pre-check: ${verdict.reason}`);
      return;
    }

    await this.ledger.record({
      userId: impression.userId,
      amount: impression.coinReward,
      sourceType: LedgerSourceType.ad,
      sourceRefId: impression.id,
      idempotencyKey: `ad:${impression.network}:${externalTxnId}`,
    });

    await this.notifications.onCredited({
      userId: impression.userId,
      coins: impression.coinReward,
      sourceType: LedgerSourceType.ad,
      sourceRefId: impression.id,
    });
  }

  private externalTxnIdOf(ssvPayload: Prisma.JsonValue | null): string | undefined {
    if (ssvPayload !== null && typeof ssvPayload === 'object' && !Array.isArray(ssvPayload)) {
      const txn = (ssvPayload as Record<string, unknown>)['external_txn_id'];
      if (typeof txn === 'string' && txn.length > 0) return txn;
    }
    return undefined;
  }
}
