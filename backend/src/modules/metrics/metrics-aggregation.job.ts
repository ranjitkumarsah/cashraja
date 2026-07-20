import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ALERT_SERVICE, AlertService } from '../../common/alerts/alert.service';
import { MetricsService } from './metrics.service';

/**
 * C4.1 — hourly metrics aggregation. Appends one MetricsSnapshot per run so the
 * dashboard reads a pre-computed time series instead of scanning the ledger on
 * every request. A failed run alerts but never throws into the scheduler.
 */
@Injectable()
export class MetricsAggregationJob {
  private readonly logger = new Logger(MetricsAggregationJob.name);

  constructor(
    private readonly metrics: MetricsService,
    @Inject(ALERT_SERVICE) private readonly alerts: AlertService,
  ) {}

  @Cron('0 * * * *', { name: 'metrics-aggregation' })
  async handleCron(): Promise<void> {
    try {
      const snapshot = await this.metrics.snapshot();
      this.logger.log(
        `Metrics snapshot captured: dau=${snapshot.dau} issued=${snapshot.coinsIssued} redeemed=${snapshot.coinsRedeemed} liability=${snapshot.outstandingLiability}`,
      );
    } catch (err) {
      this.logger.error(`Metrics aggregation failed: ${(err as Error).message}`);
      await this.alerts.alert({
        type: 'metrics_aggregation_failed',
        message: (err as Error).message,
      });
    }
  }
}
