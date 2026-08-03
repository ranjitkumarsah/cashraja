import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerSourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NOTIFICATION_HOOK, NotificationHook } from '../notifications/notification-hook';

/** Parsed PlaytimeAds server-to-server postback (all values as received). */
export interface PlaytimeCallback {
  userId: string;
  offerId: string;
  /** Coin reward, kept as the raw string it arrived as — the signature is over it. */
  amount: string;
  signature: string;
  taskId?: string;
  offerName?: string;
}

export type CreditOutcome =
  | 'credited'
  | 'duplicate'
  | 'unknown_user'
  | 'invalid_amount';

/**
 * PlaytimeAds offerwall (webview wall + S2S postback). The app opens the hosted
 * wall (buildWallUrl); on each completion PlaytimeAds calls our callback with a
 * SHA1 signature we verify before crediting through the ledger. Credits are
 * idempotent so PlaytimeAds retries never double-pay.
 */
@Injectable()
export class PlaytimeService {
  private readonly logger = new Logger(PlaytimeService.name);
  private readonly appKey: string;
  private readonly secretKeys: string[];

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(NOTIFICATION_HOOK) private readonly notifications: NotificationHook,
  ) {
    this.appKey = config.get<string>('PLAYTIME_APP_KEY') ?? '';
    this.secretKeys = (config.get<string>('PLAYTIME_SECRET_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  /** Credentials present → the callback can verify + the wall can be built. */
  get configured(): boolean {
    return this.appKey.length > 0 && this.secretKeys.length > 0;
  }

  /**
   * PlaytimeAds signature = sha1(user_id + offer_id + amount + APP_KEY + SECRET_KEY).
   * Accepts a match against ANY configured secret key (dashboard exposes both an
   * API secret and a postback secret; we don't assume which one signs).
   */
  verifySignature(cb: PlaytimeCallback): boolean {
    if (!this.configured || !cb.signature) return false;
    const provided = Buffer.from(cb.signature.toLowerCase(), 'utf8');
    return this.secretKeys.some((secret) => {
      const expected = createHash('sha1')
        .update(`${cb.userId}${cb.offerId}${cb.amount}${this.appKey}${secret}`)
        .digest('hex');
      const exp = Buffer.from(expected, 'utf8');
      return exp.length === provided.length && timingSafeEqual(exp, provided);
    });
  }

  /** Credit the verified completion (call verifySignature first). */
  async credit(cb: PlaytimeCallback): Promise<CreditOutcome> {
    const coins = Number.parseInt(cb.amount, 10);
    if (!Number.isFinite(coins) || coins <= 0) return 'invalid_amount';

    const user = await this.prisma.user.findUnique({
      where: { id: cb.userId },
      select: { id: true },
    });
    if (!user) return 'unknown_user';

    // No unique conversion id in the postback → key on user+offer+task.
    const idempotencyKey = `playtime:${cb.userId}:${cb.offerId}:${cb.taskId ?? ''}`;
    const result = await this.ledger.record({
      userId: cb.userId,
      amount: coins,
      sourceType: LedgerSourceType.offer,
      sourceRefId: cb.offerId,
      idempotencyKey,
    });
    if (result.duplicate) return 'duplicate';

    await this.notifications.onCredited({
      userId: cb.userId,
      coins,
      sourceType: LedgerSourceType.offer,
      sourceRefId: cb.offerId,
    });
    this.logger.log(
      `playtime credit: user=${cb.userId} offer=${cb.offerId} +${coins} coins`,
    );
    return 'credited';
  }

  /**
   * Android SDK application key the app inits the offerwall with (the same App
   * Key that signs the postback), or null when Playtime isn't configured. The
   * SDK renders the wall natively; rewards still credit via the S2S callback.
   * Not secret — it ships in the app.
   */
  androidAppKey(): string | null {
    return this.configured ? this.appKey : null;
  }
}
