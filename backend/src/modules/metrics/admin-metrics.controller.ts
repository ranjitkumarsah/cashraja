import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard, RolesGuard } from '../../common/auth';
import { DashboardMetrics, MetricsService } from './metrics.service';

/**
 * C4.2 — dashboard metrics (reviewer + super-admin both view). GET returns
 * live current aggregates plus a short recent time series.
 */
@ApiTags('admin')
@Controller('admin/dashboard')
@UseGuards(AdminAuthGuard, RolesGuard)
export class AdminMetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  metrics_(): Promise<DashboardMetrics> {
    return this.metrics.dashboard();
  }
}
