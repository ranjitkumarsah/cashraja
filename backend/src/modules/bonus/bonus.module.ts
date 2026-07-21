import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';
import { BONUS_RANDOM_INT, cryptoRandomInt } from './bonus-roll';
import { BonusController } from './bonus.controller';
import { BonusService } from './bonus.service';

/** Scratch/spin bonus (D3): server-rolled prizes from bonus_config. */
@Module({
  imports: [LedgerModule, ReferralModule, NotificationsModule],
  controllers: [BonusController],
  providers: [
    BonusService,
    { provide: BONUS_RANDOM_INT, useValue: cryptoRandomInt },
  ],
  exports: [BonusService],
})
export class BonusModule {}
