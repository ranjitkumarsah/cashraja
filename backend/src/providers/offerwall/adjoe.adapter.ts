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
 * Adjoe (Playtime) skeleton — NEEDS_CREDENTIALS.
 *
 * Signature scheme per Adjoe S2S postback docs: the postback arrives as a GET
 * with query parameters and `sid` = SHA1( user_uuid + trans_uuid + coin_amount
 * + ADJOE_S2S_SECRET ). Confirm the exact concatenation order in the Adjoe
 * dashboard ("Postback signature") when credentials exist — networks
 * occasionally version this.
 *
 * Env: ADJOE_S2S_SECRET (empty = adapter fails closed and should stay out of
 * OFFERWALL_NETWORKS). Launch is SDK-based on the client (no webview URL) —
 * buildLaunchUrl returns an app deep-link carrying the launch token.
 */
export class AdjoeAdapter implements OfferwallAdapter {
  readonly network = 'adjoe';

  constructor(private readonly secret: string) {}

  verifySignature(req: PostbackRequest): boolean {
    // NEEDS_CREDENTIALS: fails closed until ADJOE_S2S_SECRET is configured.
    if (!this.secret) return false;
    const q = req.query;
    const sid = firstValue(q['sid']);
    if (!sid) return false;
    const userUuid = firstValue(q['user_uuid']) ?? '';
    const transUuid = firstValue(q['trans_uuid']) ?? '';
    const coinAmount = firstValue(q['coin_amount']) ?? '';
    const expected = createHash('sha1')
      .update(`${userUuid}${transUuid}${coinAmount}${this.secret}`)
      .digest('hex');
    const a = Buffer.from(sid.toLowerCase(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parsePostback(req: PostbackRequest): CanonicalPostback {
    const source: Record<string, unknown> = { ...req.query, ...req.body };
    return {
      networkUserId: requiredString(this.network, source, 'user_uuid'),
      externalTxnId: requiredString(this.network, source, 'trans_uuid'),
      coins: requiredCoins(this.network, source, 'coin_amount'),
      externalOfferId: firstValue(req.query['campaign_uuid']),
      raw: source,
    };
  }

  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string {
    // Adjoe launches via its native SDK; the app consumes this deep link and
    // passes user id + token to the SDK as the s2s user identifier.
    const url = new URL('cashraja://offerwall/adjoe');
    url.searchParams.set('offer', offer.externalOfferId);
    url.searchParams.set('user', user.id);
    url.searchParams.set('token', launchToken);
    return url.toString();
  }
}
