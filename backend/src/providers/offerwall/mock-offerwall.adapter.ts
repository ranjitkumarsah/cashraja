import { createHmac, timingSafeEqual } from 'node:crypto';
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

export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/**
 * Fully functional mock offerwall (ARCHITECTURE_PLAN §4): deterministic
 * HMAC-SHA256 over the exact raw request body with MOCK_OFFERWALL_SECRET,
 * hex-encoded in the `x-mock-signature` header. The simulator CLI
 * (scripts/simulate-postback.ts) signs with the same scheme, so E2E tests run
 * with zero external accounts. Refused in production by env.schema.ts.
 *
 * Postback body (JSON):
 *   { "user_id": "<uuid>", "txn_id": "<unique>", "coins": 100, "offer_id": "mock-1", ... }
 */
export class MockOfferwallAdapter implements OfferwallAdapter {
  readonly network = 'mock';

  constructor(private readonly secret: string) {}

  static sign(rawBody: Buffer | string, secret: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  verifySignature(req: PostbackRequest): boolean {
    if (!this.secret) return false; // fail closed
    const provided = firstValue(req.headers[MOCK_SIGNATURE_HEADER]);
    if (!provided) return false;
    const expected = MockOfferwallAdapter.sign(req.rawBody, this.secret);
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parsePostback(req: PostbackRequest): CanonicalPostback {
    const body = req.body;
    const offerId = body['offer_id'];
    return {
      networkUserId: requiredString(this.network, body, 'user_id'),
      externalTxnId: requiredString(this.network, body, 'txn_id'),
      coins: requiredCoins(this.network, body, 'coins'),
      externalOfferId: typeof offerId === 'string' && offerId ? offerId : undefined,
      raw: body,
    };
  }

  buildLaunchUrl(user: LaunchUser, offer: LaunchOffer, launchToken: string): string {
    const url = new URL('https://mock-offerwall.invalid/launch');
    url.searchParams.set('offer', offer.externalOfferId);
    url.searchParams.set('user', user.id);
    url.searchParams.set('token', launchToken);
    return url.toString();
  }
}
