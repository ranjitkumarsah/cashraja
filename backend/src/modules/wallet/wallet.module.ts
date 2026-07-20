import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/** Wallet reads (TRD §3.2) — balance cache + keyset-paginated history. */
@Module({
  imports: [LedgerModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
