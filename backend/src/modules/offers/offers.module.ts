import { Module } from '@nestjs/common';
import { ProvidersModule } from '../../providers/providers.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

/**
 * Offers (TRD §3.4). Mock-network offers for dev/E2E are seeded by
 * `npx prisma db seed` (see prisma/seed.ts — three offers on network=mock).
 */
@Module({
  imports: [ProvidersModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
