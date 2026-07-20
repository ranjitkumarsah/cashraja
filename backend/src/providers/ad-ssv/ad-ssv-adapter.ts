import { AdNetwork } from '@prisma/client';
import { PostbackRequest } from '../offerwall/offerwall-adapter';

/**
 * Ad server-side-verification (SSV) adapter contract (ARCHITECTURE_PLAN §4).
 * TRD §3.6: NEVER credit on a client "ad completed" claim — only on the
 * network's server-to-server callback, verified here.
 */

export interface VerifiedAdReward {
  /** The user identifier the SSV callback carries (our user id). */
  networkUserId: string;
  /** Network-side unique event/transaction id — ledger key `ad:${network}:${externalTxnId}`. */
  externalTxnId: string;
  adUnitId: string;
  /**
   * Reward amount IF the SSV payload itself carries one. It is validated
   * against config `ads.max_reward_per_view`; when absent the server-side
   * config `ads.coins_per_rewarded_view` applies. Client-supplied amounts are
   * never trusted.
   */
  rewardAmount?: number;
  /** Full original payload, persisted to ad_impressions.ssv_payload. */
  raw: Record<string, unknown>;
}

export interface AdSsvAdapter {
  /** Route segment, e.g. 'mock', 'applovin', 'levelplay', 'admob'. */
  readonly network: string;
  /** ad_impressions.network enum value. */
  readonly dbNetwork: AdNetwork;

  /**
   * Verify the callback authenticity per the network's documented scheme and
   * return the parsed reward, or null when verification fails (→ 401).
   * MUST fail closed when credentials/keys are missing.
   */
  verifyCallback(req: PostbackRequest): Promise<VerifiedAdReward | null>;
}
