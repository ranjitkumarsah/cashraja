import { Injectable } from '@nestjs/common';
import { RedemptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PublicStats {
  /** all-time registered users */
  total_users: number;
  /** users seen in the last 24h */
  daily_active_users: number;
  /** ₹ value of gift cards actually issued (sum of issued denominations) */
  rewards_paid_rupees: number;
}

const DAU_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Cache the public numbers so a busy landing page never hammers the DB. */
const CACHE_TTL_MS = 60 * 1000;

/**
 * H3 — aggregate-only public stats for the marketing landing page. NO PII:
 * only counts and a rupee total, never names/emails/ids. Cached in-memory for
 * 60s. Unauthenticated (the controller carries no guard); the global throttler
 * still rate-limits it.
 */
@Injectable()
export class PublicStatsService {
  private cache: { at: number; value: PublicStats } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getStats(now: Date = new Date()): Promise<PublicStats> {
    const ts = now.getTime();
    if (this.cache && ts - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    const value = await this.compute(now);
    this.cache = { at: ts, value };
    return value;
  }

  private async compute(now: Date): Promise<PublicStats> {
    const since = new Date(now.getTime() - DAU_WINDOW_MS);
    const [totalUsers, dau, issuedByCard] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastSeenAt: { gte: since } } }),
      // Rewards paid = Σ denomination over issued redemptions. Group by card so
      // we read a handful of rows (one per distinct gift card), not one per
      // redemption — cheap at volume.
      this.prisma.redemption.groupBy({
        by: ['giftCardId'],
        where: { status: RedemptionStatus.issued },
        _count: { _all: true },
      }),
    ]);

    let rewardsPaidRupees = 0;
    if (issuedByCard.length > 0) {
      const cards = await this.prisma.giftCard.findMany({
        where: { id: { in: issuedByCard.map((r) => r.giftCardId) } },
        select: { id: true, denomination: true },
      });
      const denomById = new Map(cards.map((c) => [c.id, c.denomination]));
      for (const row of issuedByCard) {
        rewardsPaidRupees += (denomById.get(row.giftCardId) ?? 0) * row._count._all;
      }
    }

    return {
      total_users: totalUsers,
      daily_active_users: dau,
      rewards_paid_rupees: rewardsPaidRupees,
    };
  }
}
