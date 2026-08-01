import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlaytimeController } from './playtime.controller';
import { PlaytimeService } from './playtime.service';

/** PlaytimeAds offerwall — hosted wall URL + verified S2S reward postback. */
@Module({
  imports: [LedgerModule, NotificationsModule],
  controllers: [PlaytimeController],
  providers: [PlaytimeService],
})
export class PlaytimeModule {}
