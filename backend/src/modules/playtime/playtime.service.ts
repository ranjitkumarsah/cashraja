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
  private readonly androidKey: string;
  private readonly androidSecrets: string[];
  private readonly webKey: string;
  private readonly webSecret: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    @Inject(NOTIFICATION_HOOK) private readonly notifications: NotificationHook,
  ) {
    this.androidKey = config.get<string>('PLAYTIME_APP_KEY') ?? '';
    this.androidSecrets = (config.get<string>('PLAYTIME_SECRET_KEYS') ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    this.webKey = config.get<string>('PLAYTIME_WEB_APP_KEY') ?? '';
    this.webSecret = config.get<string>('PLAYTIME_WEB_SECRET') ?? '';
  }

  /**
   * (appKey, secret) pairs a postback signature is checked against — one per
   * configured Playtime app (Android SDK + Web iFrame). The signature bakes in
   * the app key, so each platform's completions verify with its own pair.
   */
  private signingPairs(): { appKey: string; secret: string }[] {
    const pairs: { appKey: string; secret: string }[] = [];
    for (const secret of this.androidSecrets) {
      if (this.androidKey) pairs.push({ appKey: this.androidKey, secret });
    }
    if (this.webKey && this.webSecret) pairs.push({ appKey: this.webKey, secret: this.webSecret });
    return pairs;
  }

  /** Any Playtime app configured → the callback can verify completions. */
  get configured(): boolean {
    return this.signingPairs().length > 0;
  }

  /**
   * PlaytimeAds signature = sha1(user_id + offer_id + amount + APP_KEY + SECRET).
   * A completion may come from the Android or the Web app, so we accept a match
   * against ANY configured (appKey, secret) pair.
   */
  verifySignature(cb: PlaytimeCallback): boolean {
    if (!cb.signature) return false;
    const provided = Buffer.from(cb.signature.toLowerCase(), 'utf8');
    return this.signingPairs().some(({ appKey, secret }) => {
      const expected = createHash('sha1')
        .update(`${cb.userId}${cb.offerId}${cb.amount}${appKey}${secret}`)
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
   * Android SDK application key the mobile app inits the offerwall with (or null
   * when unset). The SDK renders the wall natively; rewards credit via the S2S
   * callback. Not secret — it ships in the app.
   */
  androidAppKey(): string | null {
    return this.androidKey || null;
  }

  /**
   * Hosted Web iFrame offerwall URL for a user (or null when the web app isn't
   * configured). The web app embeds this; completions credit via the callback.
   */
  webWallUrl(userId: string): string | null {
    if (!this.webKey) return null;
    const url = new URL('https://web.playtimeads.com/index.php');
    url.searchParams.set('app_id', this.webKey);
    url.searchParams.set('user_id', userId);
    return url.toString();
  }
}
