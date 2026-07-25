import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Gift-card pricing rate (owner decision): coins required per ₹1 of
 * denomination. Coin cost is COMPUTED everywhere as
 * `denomination × coins_per_rupee` — the stored gift_cards.coin_cost column is
 * no longer the source of truth. Editable via the admin Config screen (seeded
 * as `{ value: 100 }` → ₹1 = 100 coins, so ₹10 = 1000, ₹50 = 5000).
 */
export const GIFTCARD_COINS_PER_RUPEE_CONFIG = {
  key: 'giftcard.coins_per_rupee',
  field: 'value',
  fallback: 100,
} as const;

/**
 * Read side of the versioned app_config table: current value of a key is the
 * row with max(version). Values are small jsonb objects (see prisma/seed.ts).
 * A short in-process TTL cache keeps hot paths (webhooks) off the DB; admin
 * config writes in Phase C bump versions, so a 60s staleness window is fine.
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly cache = new Map<string, { value: unknown; at: number }>();
  private static readonly TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  /** Latest-version value object for a key, or undefined when unset. */
  async get(key: string): Promise<unknown> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < AppConfigService.TTL_MS) return hit.value;

    const row = await this.prisma.appConfig.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
      select: { value: true },
    });
    const value = row?.value;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  /**
   * Numeric field of a config value object, e.g.
   * getNumber('offers.pending_expiry_days', 'days', 30).
   * Falls back on missing key/field or non-finite values.
   */
  async getNumber(key: string, field: string, fallback: number): Promise<number> {
    const value = await this.get(key);
    if (value !== null && typeof value === 'object') {
      const raw = (value as Record<string, unknown>)[field];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      this.logger.warn(`app_config ${key}.${field} missing/invalid — using default ${fallback}`);
    }
    return fallback;
  }

  /**
   * Gift-card conversion rate (coins per ₹1). Reads
   * `giftcard.coins_per_rupee.value`, defaulting to 100 when unset. This is the
   * single source of truth for gift-card pricing — never read
   * gift_cards.coin_cost for money math.
   */
  async giftCardCoinsPerRupee(): Promise<number> {
    return this.getNumber(
      GIFTCARD_COINS_PER_RUPEE_CONFIG.key,
      GIFTCARD_COINS_PER_RUPEE_CONFIG.field,
      GIFTCARD_COINS_PER_RUPEE_CONFIG.fallback,
    );
  }

  /** Drop the TTL cache (tests, admin config writes). */
  clearCache(): void {
    this.cache.clear();
  }
}
