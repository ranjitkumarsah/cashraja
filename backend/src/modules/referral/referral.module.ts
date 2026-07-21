import { Module } from '@nestjs/common';
import { FraudModule } from '../fraud/fraud.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

/**
 * Referral (D4). ReferralService is exported so the earning credit paths
 * (postbacks, game, streak, bonus) can call onUserEarned for the bonus
 * fan-out without importing each other.
 */
@Module({
  imports: [LedgerModule, FraudModule, NotificationsModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
