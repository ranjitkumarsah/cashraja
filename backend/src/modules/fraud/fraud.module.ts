import { Module } from '@nestjs/common';
import { FRAUD_CHECK_SERVICE, PassThroughFraudCheckService } from './fraud-check.service';
import { FRAUD_SIGNAL_HOOK, LoggingFraudSignalHook } from './fraud-signal.hook';

/**
 * Fraud hooks. Phase B: pass-through credit pre-check (FRAUD_CHECK_SERVICE).
 * Phase D adds the engagement detection signal hook (FRAUD_SIGNAL_HOOK) for
 * game farming / self-referral. The Phase E rule engine binds real
 * implementations behind both tokens.
 */
@Module({
  providers: [
    { provide: FRAUD_CHECK_SERVICE, useClass: PassThroughFraudCheckService },
    { provide: FRAUD_SIGNAL_HOOK, useClass: LoggingFraudSignalHook },
  ],
  exports: [FRAUD_CHECK_SERVICE, FRAUD_SIGNAL_HOOK],
})
export class FraudModule {}
