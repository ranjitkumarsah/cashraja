import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../providers/providers.module';
import { SurveysController } from './surveys.controller';

/** Survey-wall URLs (CPX) — reads the offerwall registry to build the wall URL. */
@Module({
  imports: [ProvidersModule],
  controllers: [SurveysController],
})
export class SurveysModule {}
