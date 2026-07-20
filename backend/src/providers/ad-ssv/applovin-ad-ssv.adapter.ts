import { AdNetwork } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { PostbackRequest, firstValue } from '../offerwall/offerwall-adapter';
import { AdSsvAdapter, VerifiedAdReward } from './ad-ssv-adapter';

/**
 * AppLovin MAX S2S rewarded callback skeleton — NEEDS_CREDENTIALS.
 *
 * MAX S2S reward callbacks are macro-based GETs ({USER_ID}, {EVENT_ID},
 * {AD_UNIT_ID}, {AMOUNT}, ...) with NO payload signature; authenticity relies
 * on (a) keeping the callback URL secret and (b) AppLovin's published egress
 * IP ranges. This skeleton therefore requires a shared token segment in the
 * callback URL (?token=APPLOVIN_CALLBACK_TOKEN) configured in the MAX
 * dashboard, and should additionally enable the IP allowlist in production.
 *
 * Env: APPLOVIN_CALLBACK_TOKEN.
 */
export class ApplovinAdSsvAdapter implements AdSsvAdapter {
  readonly network = 'applovin';
  readonly dbNetwork = AdNetwork.applovin_max;
  private readonly logger = new Logger(ApplovinAdSsvAdapter.name);

  constructor(private readonly callbackToken: string) {}

  async verifyCallback(req: PostbackRequest): Promise<VerifiedAdReward | null> {
    // NEEDS_CREDENTIALS: fails closed until APPLOVIN_CALLBACK_TOKEN is set.
    if (!this.callbackToken) {
      this.logger.warn('AppLovin SSV called but APPLOVIN_CALLBACK_TOKEN is not configured');
      return null;
    }
    if (firstValue(req.query['token']) !== this.callbackToken) return null;

    const userId = firstValue(req.query['user_id']);
    const eventId = firstValue(req.query['event_id']);
    const adUnitId = firstValue(req.query['ad_unit_id']);
    if (!userId || !eventId || !adUnitId) return null;

    const amountRaw = firstValue(req.query['amount']);
    const amount = amountRaw !== undefined ? Number(amountRaw) : NaN;
    return {
      networkUserId: userId,
      externalTxnId: eventId,
      adUnitId,
      rewardAmount: Number.isInteger(amount) && amount > 0 ? amount : undefined,
      raw: { ...req.query },
    };
  }
}
