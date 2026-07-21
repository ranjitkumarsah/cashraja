import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';
import { StreakController } from './streak.controller';
import { StreakService } from './streak.service';

/** Streaks (D2): IST-day login streak + escalating daily bonus. */
@Module({
  imports: [LedgerModule, ReferralModule, NotificationsModule],
  controllers: [StreakController],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
