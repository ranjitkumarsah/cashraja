import { Module } from '@nestjs/common';
import { AdminMetricsController } from './admin-metrics.controller';
import { MetricsAggregationJob } from './metrics-aggregation.job';
import { MetricsService } from './metrics.service';

/** C4 — dashboard metrics + hourly aggregation job. */
@Module({
  controllers: [AdminMetricsController],
  providers: [MetricsService, MetricsAggregationJob],
  exports: [MetricsService],
})
export class MetricsModule {}
