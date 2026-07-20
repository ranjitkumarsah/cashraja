import { Injectable } from '@nestjs/common';
import { MetricsSnapshot, RedemptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MetricsData {
  dau: number;
  coins_issued: number;
  coins_redeemed: number;
  offer_completion_rate: number;
  outstanding_liability: number;
}

export interface MetricsSnapshotView extends MetricsData {
  captured_at: string;
}

export interface DashboardMetrics {
  /** freshly computed at request time */
  current: MetricsData;
  /** recent hourly snapshots, oldest → newest */
  series: MetricsSnapshotView[];
}

const DAU_WINDOW_MS = 24 * 60 * 60 * 1000;
/** liability = coins reserved but not yet settled */
const OUTSTANDING_STATUSES = [
  RedemptionStatus.requested,
  RedemptionStatus.under_review,
  RedemptionStatus.approved,
];

/**
 * C4 — operational metrics. compute() runs the authoritative raw aggregates
 * (used by both the hourly job and the live dashboard read); snapshots persist
 * a time series. Coin figures are lifetime totals; DAU is a rolling 24h count.
 */
@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Authoritative live aggregates, straight from the source tables. */
  async compute(now: Date = new Date()): Promise<MetricsData> {
    const since = new Date(now.getTime() - DAU_WINDOW_MS);
    const [dau, issuedAgg, redeemedAgg, outstandingAgg, totalCompletions, creditedCompletions] =
      await Promise.all([
        this.prisma.user.count({ where: { lastSeenAt: { gte: since } } }),
        this.prisma.coinLedger.aggregate({ where: { amount: { gt: 0 } }, _sum: { amount: true } }),
        this.prisma.redemption.aggregate({
          where: { status: RedemptionStatus.issued },
          _sum: { coinAmount: true },
        }),
        this.prisma.redemption.aggregate({
          where: { status: { in: OUTSTANDING_STATUSES } },
          _sum: { coinAmount: true },
        }),
        this.prisma.offerCompletion.count(),
        this.prisma.offerCompletion.count({ where: { status: 'credited' } }),
      ]);

    return {
      dau,
      coins_issued: issuedAgg._sum.amount ?? 0,
      coins_redeemed: redeemedAgg._sum.coinAmount ?? 0,
      offer_completion_rate: totalCompletions === 0 ? 0 : creditedCompletions / totalCompletions,
      outstanding_liability: outstandingAgg._sum.coinAmount ?? 0,
    };
  }

  /** Compute + persist one immutable snapshot row (called by the hourly job). */
  async snapshot(now: Date = new Date()): Promise<MetricsSnapshot> {
    const data = await this.compute(now);
    return this.prisma.metricsSnapshot.create({
      data: {
        capturedAt: now,
        dau: data.dau,
        coinsIssued: data.coins_issued,
        coinsRedeemed: data.coins_redeemed,
        offerCompletionRate: data.offer_completion_rate,
        outstandingLiability: data.outstanding_liability,
      },
    });
  }

  /** C4.2 — live current aggregates + a short recent time series. */
  async dashboard(seriesLength = 24): Promise<DashboardMetrics> {
    const [current, snapshots] = await Promise.all([
      this.compute(),
      this.prisma.metricsSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: Math.min(Math.max(seriesLength, 1), 168),
      }),
    ]);
    return {
      current,
      series: snapshots.reverse().map(toSnapshotView),
    };
  }
}

function toSnapshotView(s: MetricsSnapshot): MetricsSnapshotView {
  return {
    captured_at: s.capturedAt.toISOString(),
    dau: s.dau,
    coins_issued: s.coinsIssued,
    coins_redeemed: s.coinsRedeemed,
    offer_completion_rate: s.offerCompletionRate,
    outstanding_liability: s.outstandingLiability,
  };
}
