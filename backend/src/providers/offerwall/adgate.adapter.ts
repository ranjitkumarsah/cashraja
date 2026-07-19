import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanonicalPostback,
  LaunchOffer,
  LaunchUser,
  OfferwallAdapter,
  PostbackRequest,
  firstValue,
  requiredCoins,
  requiredString,
} from './offerwall-adapter';

/**
 * AdGate Media skeleton — NEEDS_CREDENTIALS.
 *
 * AdGate postbacks are GETs with macros ({user_id}, {tx_id}, {points}, ...).
 * Security per AdGate docs is IP-allowlist first; the optional `hash`
 * parameter is MD5( tx_id + ADGATE_POSTBACK_SECRET ) when configured in the
 * dashboard. Confirm the configured hash formula + enable the IP allowlist
 * when credentials exist.
 *
 * Env: ADGATE_POSTBACK_SECRET, ADGATE_WALL_ID (offerwall webview id).
 */
export class AdgateAdapter implements OfferwallAdapter {
  readonly network = 'adgate';

  constructor(
    private readonly secret: string,
    private readonly wallId: string,
  ) {}

  verifySignature(req: PostbackRequest): boolean {
    // NEEDS_CREDENTIALS: fails closed until ADGATE_POSTBACK_SECRET is configured.
    if (!this.secret) return false;
    const hash = firstValue(req.query['hash']);
    if (!hash) return false;
    const txId = firstValue(req.query['tx_id']) ?? '';
    const expected = createHash('md5').update(`${txId}${this.secret}`).digest('hex');
    const a = Buffer.from(hash.toLowerCase(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parsePostback(req: PostbackRequest): CanonicalPostback {
    const source: Record<string, unknown> = { ...req.query, ...req.body };
    return {
      networkUserId: requiredString(this.network, source, 'user_id'),
      externalTxnId: requiredString(this.network, source, 'tx_id'),
      coins: requiredCoins(this.network, source, 'points'),
      externalOfferId: firstValue(req.query['offer_id']),
      raw: source,
    };
  }

  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string {
    // Webview offerwall: https://wall.adgaterewards.com/{wall_id}/{user_id}
    const wall = this.wallId || 'NEEDS_CREDENTIALS_WALL_ID';
    const url = new URL(`https://wall.adgaterewards.com/${wall}/${user.id}`);
    url.searchParams.set('s1', launchToken);
    url.searchParams.set('s2', offer.externalOfferId);
    return url.toString();
  }
}
