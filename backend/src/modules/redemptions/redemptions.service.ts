import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  GiftCard,
  LedgerSourceType,
  Redemption,
  RedemptionStatus,
  UserStatus,
} from '@prisma/client';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { AUDIT_ACTIONS, writeAuditLog } from '../../common/audit/admin-audit';
import { GiftCardCryptoService } from '../../common/crypto/giftcard-crypto.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GIFT_CARD_PROVIDER, GiftCardProvider } from '../../providers/giftcard/giftcard-provider';
import { FraudEngineService } from '../fraud/fraud-engine.service';
import { InsufficientBalanceError } from '../ledger/ledger.errors';
import { LedgerService } from '../ledger/ledger.service';
import { REDEMPTION_QUEUE, RedemptionQueue } from './redemption-queue';
import { GiftCardUnavailableException, UserBannedException } from './redemptions.errors';

export interface RedemptionView {
  id: string;
  gift_card: { id: string; brand: string; denomination: number; coin_cost: number };
  coin_amount: number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  resolved_at: string | null;
  /** Present (decrypted) ONLY on the owner's own issued redemption (delivery). */
  gift_card_code?: string | null;
}

export type FulfillmentOutcome =
  | { status: 'issued'; view: RedemptionView }
  | { status: 'approved_pending'; view: RedemptionView; reason: string };

type RedemptionWithCard = Redemption & { giftCard: GiftCard };

/**
 * C2 — redemption flow. Coins are reserve-debited at REQUEST time (the reserve
 * pattern, ARCHITECTURE_PLAN §2.1) so two simultaneous requests can never spend
 * the same balance; rejection reverses with a compensating ledger row. This
 * service owns creation, the user's history, and the shared fulfillment helper
 * used by both admin-approve and the retry worker.
 */
@Injectable()
export class RedemptionsService {
  private readonly logger = new Logger(RedemptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly crypto: GiftCardCryptoService,
    @Inject(GIFT_CARD_PROVIDER) private readonly provider: GiftCardProvider,
    @Inject(REDEMPTION_QUEUE) private readonly retryQueue: RedemptionQueue,
    @Inject(ALERT_SERVICE) private readonly alerts: AlertService,
    private readonly fraudEngine: FraudEngineService,
  ) {}

  /**
   * C2.1 — validate → reserve-debit immediately → create redemption. New
   * accounts requesting are routed to manual review (under_review) as a fraud
   * pre-screen (§5 "redemption abuse"), never blocked. Insufficient balance →
   * 400; the ledger row lock guarantees only one of two racing requests wins.
   */
  async create(userId: string, giftCardId: string): Promise<RedemptionView> {
    const giftCard = await this.prisma.giftCard.findUnique({ where: { id: giftCardId } });
    if (!giftCard || !giftCard.isActive) {
      throw new GiftCardUnavailableException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, createdAt: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.status === UserStatus.banned) {
      throw new UserBannedException('Banned users cannot redeem');
    }

    const redemptionId = randomUUID();

    // Reserve immediately (money gate). InsufficientBalance → 400.
    let reserveEntryId: string;
    try {
      const reserve = await this.ledger.reserveDebit({
        userId,
        amount: giftCard.coinCost,
        sourceType: LedgerSourceType.redemption,
        sourceRefId: redemptionId,
        idempotencyKey: reserveKey(redemptionId),
      });
      reserveEntryId = reserve.entry.id;
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        throw new BadRequestException('Insufficient balance for this redemption');
      }
      throw err;
    }

    // Fraud pre-screen (rule 5, annotate — don't block): a young account is
    // routed to manual review; a young account requesting the MAX-value card
    // additionally opens a fraud_flag (FraudEngineService is the single writer).
    const ageHours = (Date.now() - user.createdAt.getTime()) / 3_600_000;
    const isMaxValue = await this.isMaxValueCard(giftCard.coinCost);
    const screen = await this.fraudEngine
      .screenRedemption({ userId, coinCost: giftCard.coinCost, isMaxValue, accountAgeHours: ageHours })
      .catch((err: unknown) => {
        // A pre-screen failure must never block a paid-for redemption.
        this.logger.error(
          `redemption fraud pre-screen failed for ${redemptionId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return { forceReview: false };
      });
    const initialStatus = screen.forceReview
      ? RedemptionStatus.under_review
      : RedemptionStatus.requested;
    if (initialStatus === RedemptionStatus.under_review) {
      this.logger.warn(
        `redemption ${redemptionId} routed to under_review (account age ${ageHours.toFixed(1)}h, maxValue=${isMaxValue})`,
      );
    }

    try {
      const created = await this.prisma.redemption.create({
        data: {
          id: redemptionId,
          userId,
          giftCardId,
          coinAmount: giftCard.coinCost,
          status: initialStatus,
        },
        include: { giftCard: true },
      });
      return this.toView(created, { includeOwnerCode: false });
    } catch (err) {
      // Compensate: reserve succeeded but the redemption row didn't land.
      this.logger.error(
        `redemption ${redemptionId} create failed after reserve — reversing: ${(err as Error).message}`,
      );
      await this.ledger.reverse(reserveEntryId, `${reserveKey(redemptionId)}:reversal`);
      throw err;
    }
  }

  /** C2.5 — the caller's own redemption history + status. Owner sees the code. */
  async mine(userId: string): Promise<RedemptionView[]> {
    const rows = await this.prisma.redemption.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      include: { giftCard: true },
    });
    return rows.map((r) => this.toView(r, { includeOwnerCode: true }));
  }

  /**
   * Shared fulfillment attempt (used by admin approve + retry worker). The
   * redemption MUST already be `approved`. On stock → issues the code
   * atomically; on empty/error → keeps it approved and enqueues a retry so a
   * paid redemption is never lost.
   */
  async attemptFulfillment(
    redemptionId: string,
    adminId: string,
    opts: { enqueueOnFailure?: boolean } = {},
  ): Promise<FulfillmentOutcome> {
    const enqueueOnFailure = opts.enqueueOnFailure ?? true;
    const redemption = await this.prisma.redemption.findUnique({
      where: { id: redemptionId },
      include: { giftCard: true },
    });
    if (!redemption) {
      throw new Error(`attemptFulfillment: redemption ${redemptionId} not found`);
    }
    if (redemption.status === RedemptionStatus.issued) {
      return { status: 'issued', view: this.toView(redemption, { includeOwnerCode: false }) };
    }

    let result;
    try {
      result = await this.provider.fulfill({
        redemptionId,
        userId: redemption.userId,
        brand: redemption.giftCard.brand,
        denomination: redemption.giftCard.denomination,
      });
    } catch (err) {
      result = { status: 'failed' as const, reason: (err as Error).message };
    }

    if (result.status === 'issued') {
      const view = await this.finalizeIssued(redemptionId, result.codeEncrypted, adminId);
      return { status: 'issued', view };
    }

    // Not fulfilled: keep approved. Enqueue a retry (unless the caller is
    // already the retry worker, which owns BullMQ backoff). Never lose it.
    const reason = result.status === 'out_of_stock' ? 'out_of_stock' : result.reason;
    if (enqueueOnFailure) {
      await this.enqueueRetry(redemptionId, reason);
    }
    const view = this.toView(redemption, { includeOwnerCode: false });
    return { status: 'approved_pending', view, reason };
  }

  /**
   * Atomically issue the code: flip approved → issued, store the encrypted code
   * on the redemption, and create the in-app delivery notification — all in one
   * transaction. Idempotent: if another worker already issued it, the
   * conditional update no-ops and no duplicate notification is written.
   */
  async finalizeIssued(
    redemptionId: string,
    codeEncrypted: string,
    adminId: string,
  ): Promise<RedemptionView> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.redemption.updateMany({
        where: { id: redemptionId, status: RedemptionStatus.approved },
        data: {
          status: RedemptionStatus.issued,
          giftCardCode: codeEncrypted,
          resolvedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        return; // already issued by a concurrent path — idempotent no-op
      }
      const redemption = await tx.redemption.findUnique({
        where: { id: redemptionId },
        include: { giftCard: true },
      });
      await writeAuditLog(tx, {
        adminId,
        action: AUDIT_ACTIONS.REDEMPTION_ISSUED,
        targetType: 'redemption',
        targetId: redemptionId,
      });
      await tx.notification.create({
        data: {
          userId: redemption!.userId,
          type: 'redemption_issued',
          title: 'Gift card ready',
          body: `Your ${redemption!.giftCard.brand} ₹${redemption!.giftCard.denomination} gift card has been issued. Tap to view your code.`,
        },
      });
    });

    const fresh = await this.prisma.redemption.findUnique({
      where: { id: redemptionId },
      include: { giftCard: true },
    });
    return this.toView(fresh!, { includeOwnerCode: false });
  }

  async enqueueRetry(redemptionId: string, reason: string): Promise<void> {
    try {
      await this.retryQueue.enqueue({ redemptionId });
    } catch (err) {
      this.logger.error(
        `failed to enqueue redemption retry ${redemptionId}: ${(err as Error).message}`,
      );
    }
    await this.alerts.alert({
      type: 'redemption_fulfillment_deferred',
      message: `Redemption ${redemptionId} approved but not fulfilled (${reason}) — queued for retry`,
      details: { redemptionId, reason },
    });
  }

  /** True when coinCost is the maximum coin_cost across the active catalog. */
  private async isMaxValueCard(coinCost: number): Promise<boolean> {
    const max = await this.prisma.giftCard.aggregate({
      where: { isActive: true },
      _max: { coinCost: true },
    });
    return coinCost >= (max._max.coinCost ?? coinCost);
  }

  /** Map a redemption to its API view. Decrypts the code only for the owner. */
  toView(
    redemption: RedemptionWithCard,
    opts: { includeOwnerCode: boolean },
  ): RedemptionView {
    const view: RedemptionView = {
      id: redemption.id,
      gift_card: {
        id: redemption.giftCard.id,
        brand: redemption.giftCard.brand,
        denomination: redemption.giftCard.denomination,
        coin_cost: redemption.giftCard.coinCost,
      },
      coin_amount: redemption.coinAmount,
      status: redemption.status,
      rejection_reason: redemption.rejectionReason,
      created_at: redemption.createdAt.toISOString(),
      resolved_at: redemption.resolvedAt ? redemption.resolvedAt.toISOString() : null,
    };
    if (opts.includeOwnerCode) {
      // Owner-only delivery (TRD §8): the code is decrypted for display to the
      // user who redeemed it, and only once it's issued.
      view.gift_card_code =
        redemption.status === RedemptionStatus.issued && redemption.giftCardCode
          ? this.crypto.decrypt(redemption.giftCardCode)
          : null;
    }
    return view;
  }
}

export function reserveKey(redemptionId: string): string {
  return `redemption:${redemptionId}`;
}
