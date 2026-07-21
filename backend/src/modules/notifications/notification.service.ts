import { Inject, Injectable, Logger } from '@nestjs/common';
import { LedgerSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../wallet/wallet.service';
import { CreditNotification, NotificationHook } from './notification-hook';
import { FCM_DRIVER, FcmDriver } from './fcm-driver';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface NotificationPage {
  notifications: NotificationView[];
  unread_count: number;
  next_cursor: string | null;
}

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  /** optional structured payload delivered with the push (string values only) */
  data?: Record<string, string>;
}

export const NOTIFICATION_PAGE_DEFAULT_LIMIT = 20;
export const NOTIFICATION_PAGE_MAX_LIMIT = 100;

/**
 * E2 — notifications: durable in-app inbox (notifications table) + best-effort
 * FCM push behind FcmDriver. Bound behind NOTIFICATION_HOOK so every credit path
 * (offers/ads already; game/streak/bonus/referral wired in Phase E) delivers a
 * "coins credited" notification. All delivery is async and swallows errors — a
 * notification must never fail or slow a coin credit.
 */
@Injectable()
export class NotificationService implements NotificationHook {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FCM_DRIVER) private readonly fcm: FcmDriver,
  ) {}

  // ─────────────────────── triggers ───────────────────────

  /** NOTIFICATION_HOOK: fired after any coin credit. */
  async onCredited(notification: CreditNotification): Promise<void> {
    const { title, body } = creditCopy(notification.sourceType, notification.coins);
    await this.notify({
      userId: notification.userId,
      type: `credit_${notification.sourceType}`,
      title,
      body,
      data: { kind: 'credit', source: notification.sourceType, coins: String(notification.coins) },
    });
  }

  /** Redemption status change (approved / issued / rejected). */
  async onRedemptionStatus(input: {
    userId: string;
    status: 'approved' | 'issued' | 'rejected';
    brand: string;
    denomination: number;
    reason?: string;
  }): Promise<void> {
    const copy = redemptionCopy(input);
    await this.notify({
      userId: input.userId,
      type: `redemption_${input.status}`,
      title: copy.title,
      body: copy.body,
      data: { kind: 'redemption', status: input.status },
    });
  }

  /**
   * Create an inbox row and push it. Idempotent-safe to call from post-commit
   * paths; never throws. Returns nothing — callers must not depend on delivery.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: { userId: input.userId, type: input.type, title: input.title, body: input.body },
      });
    } catch (err) {
      this.logger.error(
        `failed to persist notification for ${input.userId}: ${(err as Error).message}`,
      );
    }
    await this.push(input);
  }

  /** FCM-only push to all of a user's registered tokens (no inbox row). */
  async push(input: NotifyInput): Promise<void> {
    let tokens: Array<{ token: string }>;
    try {
      tokens = await this.prisma.fcmToken.findMany({
        where: { userId: input.userId },
        select: { token: true },
      });
    } catch (err) {
      this.logger.error(`failed to load fcm tokens for ${input.userId}: ${(err as Error).message}`);
      return;
    }
    await Promise.all(
      tokens.map((t) =>
        this.fcm
          .send({ token: t.token, title: input.title, body: input.body, data: input.data })
          .catch((err: unknown) =>
            this.logger.warn(
              `fcm send failed (token ${t.token.slice(0, 6)}…): ${
                err instanceof Error ? err.message : String(err)
              }`,
            ),
          ),
      ),
    );
  }

  // ─────────────────────── token registration ───────────────────────

  /** Upsert a device FCM token for the user (idempotent on the token). */
  async registerToken(userId: string, token: string): Promise<void> {
    await this.prisma.fcmToken.upsert({
      where: { token },
      update: { userId, lastSeenAt: new Date() },
      create: { userId, token },
    });
  }

  // ─────────────────────── inbox reads ───────────────────────

  /** Keyset-paginated inbox, newest first, plus the unread count. */
  async list(userId: string, cursor: string | undefined, limit: number | undefined): Promise<NotificationPage> {
    const take = Math.min(Math.max(limit ?? NOTIFICATION_PAGE_DEFAULT_LIMIT, 1), NOTIFICATION_PAGE_MAX_LIMIT);
    const where: Prisma.NotificationWhereInput = { userId };
    const decoded = cursor !== undefined ? decodeCursor(cursor) : null;
    if (decoded) {
      where.OR = [
        { createdAt: { lt: decoded.createdAt } },
        { createdAt: decoded.createdAt, id: { lt: decoded.id } },
      ];
    }
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const page = rows.slice(0, take);
    const last = page[page.length - 1];
    return {
      notifications: page.map(toView),
      unread_count: unread,
      next_cursor: rows.length > take && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /** Mark a single notification read (owner-scoped; idempotent). */
  async markRead(userId: string, id: string): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}

function toView(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.readAt !== null,
    created_at: n.createdAt.toISOString(),
  };
}

/** Credit notification copy per ledger source type. */
function creditCopy(source: LedgerSourceType, coins: number): { title: string; body: string } {
  const amount = `${coins} coin${coins === 1 ? '' : 's'}`;
  switch (source) {
    case LedgerSourceType.offer:
      return { title: 'Offer reward credited', body: `You earned ${amount} for completing an offer.` };
    case LedgerSourceType.ad:
      return { title: 'Reward credited', body: `You earned ${amount} for watching an ad.` };
    case LedgerSourceType.game:
      return { title: 'Game reward', body: `Nice play! ${amount} added to your wallet.` };
    case LedgerSourceType.streak:
      return { title: 'Streak bonus', body: `Your daily streak paid out ${amount}. Keep it going!` };
    case LedgerSourceType.bonus:
      return { title: 'You won a prize', body: `Your scratch/spin awarded ${amount}.` };
    case LedgerSourceType.referral:
      return { title: 'Referral bonus', body: `You earned ${amount} from a friend's activity.` };
    default:
      return { title: 'Coins credited', body: `${amount} added to your wallet.` };
  }
}

function redemptionCopy(input: {
  status: 'approved' | 'issued' | 'rejected';
  brand: string;
  denomination: number;
  reason?: string;
}): { title: string; body: string } {
  const card = `${input.brand} ₹${input.denomination}`;
  switch (input.status) {
    case 'approved':
      return { title: 'Redemption approved', body: `Your ${card} gift card was approved and is being issued.` };
    case 'issued':
      return { title: 'Gift card ready', body: `Your ${card} gift card has been issued. Tap to view your code.` };
    case 'rejected':
      return {
        title: 'Redemption rejected',
        body: `Your ${card} redemption was rejected${input.reason ? `: ${input.reason}` : ''}. Coins were returned to your wallet.`,
      };
  }
}
