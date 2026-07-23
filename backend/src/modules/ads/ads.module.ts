import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';
import { AdRewardController } from './ad-reward.controller';
import { AdRewardService } from './ad-reward.service';

/**
 * G7 — client-gated rewarded-ad credit ("Watch & earn"). Server-authoritative
 * amount, per-user daily cap + cooldown. SSV hardening lives in PostbacksModule.
 */
@Module({
  imports: [LedgerModule, ReferralModule, NotificationsModule],
  controllers: [AdRewardController],
  providers: [AdRewardService],
  exports: [AdRewardService],
})
export class AdsModule {}
