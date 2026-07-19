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
 * OfferToro skeleton — NEEDS_CREDENTIALS.
 *
 * Documented OfferToro postback signature: `sig` query parameter =
 * MD5( oid + "-" + user_id + "-" + OFFERTORO_SECRET_KEY ). Amount arrives in
 * `amount` (publisher currency). Also enable OfferToro's IP allowlist in
 * production.
 *
 * Env: OFFERTORO_SECRET_KEY, OFFERTORO_APP_ID, OFFERTORO_PUB_ID.
 */
export class OffertoroAdapter implements OfferwallAdapter {
  readonly network = 'offertoro';

  constructor(
    private readonly secret: string,
    private readonly appId: string,
    private readonly pubId: string,
  ) {}

  verifySignature(req: PostbackRequest): boolean {
    // NEEDS_CREDENTIALS: fails closed until OFFERTORO_SECRET_KEY is configured.
    if (!this.secret) return false;
    const sig = firstValue(req.query['sig']);
    if (!sig) return false;
    const oid = firstValue(req.query['oid']) ?? '';
    const userId = firstValue(req.query['user_id']) ?? '';
    const expected = createHash('md5').update(`${oid}-${userId}-${this.secret}`).digest('hex');
    const a = Buffer.from(sig.toLowerCase(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parsePostback(req: PostbackRequest): CanonicalPostback {
    const source: Record<string, unknown> = { ...req.query, ...req.body };
    return {
      networkUserId: requiredString(this.network, source, 'user_id'),
      // o_trans_id is OfferToro's unique transaction id
      externalTxnId: requiredString(this.network, source, 'o_trans_id'),
      coins: requiredCoins(this.network, source, 'amount'),
      externalOfferId: firstValue(req.query['oid']),
      raw: source,
    };
  }

  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string {
    // Webview offerwall: https://www.offertoro.com/ifr/show/{pub_id}/{user_id}/{app_id}
    const pub = this.pubId || 'NEEDS_CREDENTIALS_PUB_ID';
    const app = this.appId || 'NEEDS_CREDENTIALS_APP_ID';
    const url = new URL(`https://www.offertoro.com/ifr/show/${pub}/${user.id}/${app}`);
    url.searchParams.set('subid1', launchToken);
    url.searchParams.set('subid2', offer.externalOfferId);
    return url.toString();
  }
}
