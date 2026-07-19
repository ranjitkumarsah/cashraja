import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ALERT_SERVICE, AlertService } from '../common/alerts/alert.service';
import { PrismaService } from '../common/prisma/prisma.service';

export interface DriftRecord {
  userId: string;
  cached: number;
  ledgerSum: number;
  drift: number;
}

export interface ReconciliationReport {
  usersChecked: number;
  driftCount: number;
  drifts: DriftRecord[];
}

/**
 * Nightly ledger reconciliation (Testing & Deployment doc §9): compares
 * users.coin_balance_cached against SUM(coin_ledger.amount) for every user.
 * Drift should never happen — any hit is a real bug and raises an alert.
 * The cache is NEVER silently "fixed" here; humans investigate first.
 */
@Injectable()
export class LedgerReconciliationJob {
  private readonly logger = new Logger(LedgerReconciliationJob.name);
  private static readonly BATCH_SIZE = 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ALERT_SERVICE) private readonly alerts: AlertService,
  ) {}

  @Cron('0 2 * * *', { name: 'ledger-reconciliation' })
  async handleCron(): Promise<void> {
    try {
      const report = await this.run();
      this.logger.log(
        `Ledger reconciliation done: ${report.usersChecked} users checked, ${report.driftCount} drift(s)`,
      );
    } catch (err) {
      this.logger.error(`Ledger reconciliation failed: ${(err as Error).message}`);
      await this.alerts.alert({
        type: 'ledger_reconciliation_failed',
        message: (err as Error).message,
      });
    }
  }

  /** Full sweep; batched keyset pagination so it stays bounded at volume. */
  async run(): Promise<ReconciliationReport> {
    const drifts: DriftRecord[] = [];
    let usersChecked = 0;
    let cursor: string | undefined;

    for (;;) {
      const users = await this.prisma.user.findMany({
        select: { id: true, coinBalanceCached: true },
        orderBy: { id: 'asc' },
        take: LedgerReconciliationJob.BATCH_SIZE,
        ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (users.length === 0) break;

      const sums = await this.prisma.coinLedger.groupBy({
        by: ['userId'],
        where: { userId: { in: users.map((u) => u.id) } },
        _sum: { amount: true },
      });
      const sumByUser = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));

      for (const user of users) {
        usersChecked += 1;
        const ledgerSum = sumByUser.get(user.id) ?? 0;
        if (ledgerSum !== user.coinBalanceCached) {
          drifts.push({
            userId: user.id,
            cached: user.coinBalanceCached,
            ledgerSum,
            drift: user.coinBalanceCached - ledgerSum,
          });
        }
      }

      const last = users[users.length - 1];
      if (users.length < LedgerReconciliationJob.BATCH_SIZE || !last) break;
      cursor = last.id;
    }

    if (drifts.length > 0) {
      await this.alerts.alert({
        type: 'ledger_drift',
        message: `Ledger drift detected for ${drifts.length} user(s) — cached balance != SUM(ledger). This is a bug; investigate before touching the cache.`,
        details: { drifts: drifts.slice(0, 50), driftCount: drifts.length },
      });
    }

    return { usersChecked, driftCount: drifts.length, drifts };
  }
}
