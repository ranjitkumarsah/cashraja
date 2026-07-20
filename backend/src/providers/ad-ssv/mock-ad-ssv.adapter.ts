import { createHmac, timingSafeEqual } from 'node:crypto';
import { AdNetwork } from '@prisma/client';
import { PostbackRequest, firstValue } from '../offerwall/offerwall-adapter';
import { AdSsvAdapter, VerifiedAdReward } from './ad-ssv-adapter';

export const MOCK_AD_SIGNATURE_HEADER = 'x-mock-ssv-signature';

/**
 * Fully functional mock ad-SSV driver: HMAC-SHA256 over the raw body with
 * MOCK_AD_SSV_SECRET, hex in `x-mock-ssv-signature`. Body (JSON):
 *   { "user_id": "<uuid>", "txn_id": "<unique>", "ad_unit_id": "mock-rewarded", "reward"?: 5 }
 * Refused in production by env.schema.ts.
 */
export class MockAdSsvAdapter implements AdSsvAdapter {
  readonly network = 'mock';
  readonly dbNetwork = AdNetwork.mock;

  constructor(private readonly secret: string) {}

  static sign(rawBody: Buffer | string, secret: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('hex');
  }

  async verifyCallback(req: PostbackRequest): Promise<VerifiedAdReward | null> {
    if (!this.secret) return null; // fail closed
    const provided = firstValue(req.headers[MOCK_AD_SIGNATURE_HEADER]);
    if (!provided) return null;
    const expected = MockAdSsvAdapter.sign(req.rawBody, this.secret);
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const body = req.body;
    const userId = body['user_id'];
    const txnId = body['txn_id'];
    const adUnitId = body['ad_unit_id'];
    if (typeof userId !== 'string' || !userId) return null;
    if (typeof txnId !== 'string' || !txnId) return null;
    if (typeof adUnitId !== 'string' || !adUnitId) return null;

    const reward = body['reward'];
    return {
      networkUserId: userId,
      externalTxnId: txnId,
      adUnitId,
      rewardAmount: typeof reward === 'number' && Number.isInteger(reward) ? reward : undefined,
      raw: body,
    };
  }
}
