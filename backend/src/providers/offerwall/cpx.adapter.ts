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
 * CPX Research skeleton — NEEDS_CREDENTIALS.
 *
 * Documented CPX postback security: `hash` query parameter =
 * MD5( trans_id + "-" + CPX_SECURE_HASH ) where CPX_SECURE_HASH is the app's
 * secure hash from the CPX publisher dashboard. Survey wall is webview-based:
 * https://offers.cpx-research.com/index.php?app_id=...&ext_user_id=...&secure_hash=...
 *
 * Env: CPX_SECURE_HASH, CPX_APP_ID.
 */
export class CpxAdapter implements OfferwallAdapter {
  readonly network = 'cpx';

  constructor(
    private readonly secureHash: string,
    private readonly appId: string,
  ) {}

  verifySignature(req: PostbackRequest): boolean {
    // NEEDS_CREDENTIALS: fails closed until CPX_SECURE_HASH is configured.
    if (!this.secureHash) return false;
    const hash = firstValue(req.query['hash']);
    if (!hash) return false;
    const transId = firstValue(req.query['trans_id']) ?? '';
    const expected = createHash('md5').update(`${transId}-${this.secureHash}`).digest('hex');
    const a = Buffer.from(hash.toLowerCase(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parsePostback(req: PostbackRequest): CanonicalPostback {
    const source: Record<string, unknown> = { ...req.query, ...req.body };
    return {
      networkUserId: requiredString(this.network, source, 'user_id'),
      externalTxnId: requiredString(this.network, source, 'trans_id'),
      coins: requiredCoins(this.network, source, 'amount_local'),
      externalOfferId: firstValue(req.query['offer_id']),
      raw: source,
    };
  }

  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string {
    const app = this.appId || 'NEEDS_CREDENTIALS_APP_ID';
    const url = new URL('https://offers.cpx-research.com/index.php');
    url.searchParams.set('app_id', app);
    url.searchParams.set('ext_user_id', user.id);
    // secure_hash for the wall URL = md5(ext_user_id + "-" + CPX_SECURE_HASH)
    const secure = this.secureHash
      ? createHash('md5').update(`${user.id}-${this.secureHash}`).digest('hex')
      : 'NEEDS_CREDENTIALS';
    url.searchParams.set('secure_hash', secure);
    url.searchParams.set('subid_1', launchToken);
    url.searchParams.set('subid_2', offer.externalOfferId);
    return url.toString();
  }
}
