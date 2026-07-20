import { createVerify } from 'node:crypto';
import { AdNetwork } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { PostbackRequest, firstValue } from '../offerwall/offerwall-adapter';
import { AdSsvAdapter, VerifiedAdReward } from './ad-ssv-adapter';

interface AdmobPublicKey {
  keyId: number;
  pem: string;
}

/**
 * AdMob rewarded SSV skeleton — NEEDS_CREDENTIALS (no shared secret; needs a
 * live key server + real callbacks to finish verification wiring).
 *
 * Documented AdMob scheme: the callback GET carries `signature` and `key_id`;
 * the signed content is the query string UP TO (excluding) `&signature=...`,
 * verified with ECDSA-SHA256 against Google's rotating public keys published
 * at https://www.gstatic.com/admob/reward/verifier-keys.json. This skeleton
 * implements the full verify path with a pluggable key fetcher (cached), but
 * stays out of AD_NETWORKS until verified against live traffic.
 */
export class AdmobAdSsvAdapter implements AdSsvAdapter {
  readonly network = 'admob';
  readonly dbNetwork = AdNetwork.admob;
  private readonly logger = new Logger(AdmobAdSsvAdapter.name);
  private keys: AdmobPublicKey[] | null = null;
  private keysFetchedAt = 0;
  private static readonly KEY_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly keyServerUrl: string,
    /** Injectable for tests; default fetches Google's verifier keys. */
    private readonly fetchKeys?: () => Promise<AdmobPublicKey[]>,
  ) {}

  async verifyCallback(req: PostbackRequest): Promise<VerifiedAdReward | null> {
    // NEEDS_CREDENTIALS: fails closed until ADMOB_SSV_KEY_SERVER_URL is set
    // (set it to the documented gstatic URL to activate).
    if (!this.keyServerUrl && !this.fetchKeys) return null;

    const q = req.query;
    const signature = firstValue(q['signature']);
    const keyIdRaw = firstValue(q['key_id']);
    const userId = firstValue(q['user_id']);
    const transactionId = firstValue(q['transaction_id']);
    if (!signature || !keyIdRaw || !userId || !transactionId) return null;

    // Signed content: raw query string up to (excluding) "&signature=".
    const rawQuery = this.rawQueryOf(req);
    const idx = rawQuery.indexOf('&signature=');
    if (idx < 0) return null;
    const signedContent = rawQuery.slice(0, idx);

    const keys = await this.loadKeys();
    const key = keys.find((k) => k.keyId === Number(keyIdRaw));
    if (!key) {
      this.logger.warn(`AdMob SSV key_id ${keyIdRaw} not found in verifier key set`);
      return null;
    }

    try {
      const verifier = createVerify('sha256');
      verifier.update(signedContent);
      // AdMob signatures are web-safe base64 without padding
      const sig = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      if (!verifier.verify(key.pem, sig)) return null;
    } catch (err) {
      this.logger.warn(`AdMob SSV verification error: ${(err as Error).message}`);
      return null;
    }

    const amountRaw = firstValue(q['reward_amount']);
    const amount = amountRaw !== undefined ? Number(amountRaw) : NaN;
    return {
      networkUserId: userId,
      externalTxnId: transactionId,
      adUnitId: firstValue(q['ad_unit']) ?? 'admob-rewarded',
      rewardAmount: Number.isInteger(amount) && amount > 0 ? amount : undefined,
      raw: { ...q },
    };
  }

  private rawQueryOf(req: PostbackRequest): string {
    // Express keeps the original URL on the request; PostbackRequest carries
    // the query already parsed, so reconstruct in insertion order. The
    // signature-relevant ordering is preserved by Node's query parser.
    const parts: string[] = [];
    for (const [k, v] of Object.entries(req.query)) {
      const values = Array.isArray(v) ? v : [v];
      for (const value of values) {
        parts.push(`${k}=${value ?? ''}`);
      }
    }
    return parts.join('&');
  }

  private async loadKeys(): Promise<AdmobPublicKey[]> {
    const now = Date.now();
    if (this.keys && now - this.keysFetchedAt < AdmobAdSsvAdapter.KEY_TTL_MS) {
      return this.keys;
    }
    try {
      const fetcher = this.fetchKeys ?? (() => this.fetchFromKeyServer());
      this.keys = await fetcher();
      this.keysFetchedAt = now;
    } catch (err) {
      this.logger.warn(`AdMob verifier key fetch failed: ${(err as Error).message}`);
      this.keys = this.keys ?? [];
    }
    return this.keys;
  }

  private async fetchFromKeyServer(): Promise<AdmobPublicKey[]> {
    const res = await fetch(this.keyServerUrl);
    if (!res.ok) throw new Error(`key server responded ${res.status}`);
    const json = (await res.json()) as { keys?: Array<{ keyId: number; pem: string }> };
    return (json.keys ?? []).map((k) => ({ keyId: k.keyId, pem: k.pem }));
  }
}
