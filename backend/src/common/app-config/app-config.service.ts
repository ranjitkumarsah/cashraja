import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  /** Drop the TTL cache (tests, admin config writes). */
  clearCache(): void {
    this.cache.clear();
  }
}
