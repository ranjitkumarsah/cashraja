import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicStatsService } from './public-stats.service';

/** H3 — public, unauthenticated landing-page stats (aggregate only). */
@Module({
  controllers: [PublicController],
  providers: [PublicStatsService],
})
export class PublicModule {}
