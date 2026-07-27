import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PublicStats, PublicStatsService } from './public-stats.service';

/**
 * Unauthenticated, aggregate-only stats for the marketing landing page.
 * No guard = public; the global throttler still rate-limits. Served under
 * `/api/public/*`.
 */
@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly stats: PublicStatsService) {}

  @Get('stats')
  @ApiOkResponse({
    description: 'Aggregate community stats (no PII) for the landing page.',
  })
  getStats(): Promise<PublicStats> {
    return this.stats.getStats();
  }
}
