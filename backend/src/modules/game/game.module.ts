import { Module } from '@nestjs/common';
import { FraudModule } from '../fraud/fraud.module';
import { LedgerModule } from '../ledger/ledger.module';
import { ReferralModule } from '../referral/referral.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

/** Game (D1): server-issued rounds + credit on completion. */
@Module({
  imports: [LedgerModule, FraudModule, ReferralModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
