import { Module } from '@nestjs/common';
import { FRAUD_CHECK_SERVICE, PassThroughFraudCheckService } from './fraud-check.service';

/**
 * Fraud hooks (Phase B: pass-through stub only; rule engine lands in Phase E
 * behind the same FRAUD_CHECK_SERVICE token).
 */
@Module({
  providers: [{ provide: FRAUD_CHECK_SERVICE, useClass: PassThroughFraudCheckService }],
  exports: [FRAUD_CHECK_SERVICE],
})
export class FraudModule {}
