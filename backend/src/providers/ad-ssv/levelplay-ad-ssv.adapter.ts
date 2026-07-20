import { createHash, timingSafeEqual } from 'node:crypto';
import { AdNetwork } from '@prisma/client';
import { PostbackRequest, firstValue } from '../offerwall/offerwall-adapter';
import { AdSsvAdapter, VerifiedAdReward } from './ad-ssv-adapter';

/**
 * Unity LevelPlay (ironSource) SSV skeleton — NEEDS_CREDENTIALS.
 *
 * Documented LevelPlay server-to-server callback signature:
 *   signature = MD5( timestamp + eventId + userId + rewards + PRIVATE_KEY )
 * delivered as query parameters timestamp, eventId, userId (appUserId),
 * rewards, signature. Confirm parameter naming against the LevelPlay
 * dashboard when credentials exist.
 *
 * Env: LEVELPLAY_PRIVATE_KEY.
 */
export class LevelplayAdSsvAdapter implements AdSsvAdapter {
  readonly network = 'levelplay';
  readonly dbNetwork = AdNetwork.unity_levelplay;

  constructor(private readonly privateKey: string) {}

  async verifyCallback(req: PostbackRequest): Promise<VerifiedAdReward | null> {
    // NEEDS_CREDENTIALS: fails closed until LEVELPLAY_PRIVATE_KEY is set.
    if (!this.privateKey) return null;
    const q = req.query;
    const signature = firstValue(q['signature']);
    const timestamp = firstValue(q['timestamp']) ?? '';
    const eventId = firstValue(q['eventId']);
    const userId = firstValue(q['userId']);
    const rewards = firstValue(q['rewards']) ?? '';
    if (!signature || !eventId || !userId) return null;

    const expected = createHash('md5')
      .update(`${timestamp}${eventId}${userId}${rewards}${this.privateKey}`)
      .digest('hex');
    const a = Buffer.from(signature.toLowerCase(), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const amount = Number(rewards);
    return {
      networkUserId: userId,
      externalTxnId: eventId,
      adUnitId: firstValue(q['adUnitId']) ?? 'levelplay-rewarded',
      rewardAmount: Number.isInteger(amount) && amount > 0 ? amount : undefined,
      raw: { ...q },
    };
  }
}
