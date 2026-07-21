import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FraudModule } from '../fraud/fraud.module';
import { GiftCardsModule } from '../gift-cards/gift-cards.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRedemptionsController } from './admin-redemptions.controller';
import { AdminRedemptionsService } from './admin-redemptions.service';
import { BullRedemptionQueue, REDEMPTION_QUEUE, RedemptionQueue } from './redemption-queue';
import { RedemptionRetryWorker } from './redemption-retry.worker';
import { RedemptionsController } from './redemptions.controller';
import { RedemptionsService } from './redemptions.service';

/**
 * C2 — redemption flow (reserve-debit at request, admin approve/reject, retry
 * queue). GiftCardsModule supplies the GIFT_CARD_PROVIDER (ManualInventory);
 * LedgerModule supplies reserve/reverse. Crypto/alerts/app-config are global.
 */
@Module({
  imports: [LedgerModule, GiftCardsModule, FraudModule, NotificationsModule],
  controllers: [RedemptionsController, AdminRedemptionsController],
  providers: [
    {
      provide: REDEMPTION_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RedemptionQueue =>
        BullRedemptionQueue.create(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'),
    },
    RedemptionsService,
    AdminRedemptionsService,
    RedemptionRetryWorker,
  ],
  exports: [RedemptionsService, AdminRedemptionsService],
})
export class RedemptionsModule {}
