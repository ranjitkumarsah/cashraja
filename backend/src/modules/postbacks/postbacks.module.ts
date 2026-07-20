import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerModule } from '../ledger/ledger.module';
import { FraudModule } from '../fraud/fraud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProvidersModule } from '../../providers/providers.module';
import { AdIntakeService } from './ad-intake.service';
import { AdsWebhookController } from './ads-webhook.controller';
import { OfferwallWebhookController } from './offerwall-webhook.controller';
import { PendingExpiryJob } from './pending-expiry.job';
import { PostbackIntakeService } from './postback-intake.service';
import { PostbackProcessorService } from './postback-processor.service';
import { PostbackWorker } from './postback.worker';
import { BullPostbackQueue, POSTBACK_QUEUE, PostbackQueue } from './postback-queue';

/**
 * Postback pipeline (ARCHITECTURE_PLAN §2.2): fast-200 webhook intake +
 * durable BullMQ processing. Queue and worker share REDIS_URL; the worker can
 * be split into its own process via POSTBACK_WORKER_ENABLED=false here and
 * true there.
 */
@Module({
  imports: [LedgerModule, FraudModule, NotificationsModule, ProvidersModule],
  controllers: [OfferwallWebhookController, AdsWebhookController],
  providers: [
    {
      provide: POSTBACK_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PostbackQueue =>
        BullPostbackQueue.create(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379'),
    },
    PostbackIntakeService,
    AdIntakeService,
    PostbackProcessorService,
    PostbackWorker,
    PendingExpiryJob,
  ],
  exports: [POSTBACK_QUEUE],
})
export class PostbacksModule {}
