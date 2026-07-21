import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FRAUD_CHECK_SERVICE } from './fraud-check.service';
import { FraudEngineService } from './fraud-engine.service';
import { createSlidingWindow } from './fraud-redis';
import { FRAUD_SIGNAL_HOOK } from './fraud-signal.hook';
import { RuleEngineFraudCheckService } from './rule-engine-fraud-check.service';
import { RuleEngineFraudSignalHook } from './rule-engine-fraud-signal.hook';
import { SLIDING_WINDOW } from './sliding-window';

/**
 * E1 — fraud rule engine. The Phase-B/D stubs behind FRAUD_CHECK_SERVICE and
 * FRAUD_SIGNAL_HOOK are replaced here with real rule-engine implementations, so
 * every existing consumer (postback worker, game, referral) picks up real fraud
 * behavior with no rewiring. FraudEngineService is exported for the redemption
 * pre-screen (rule 5). SLIDING_WINDOW is the Redis velocity-counter backend.
 */
@Module({
  providers: [
    {
      provide: SLIDING_WINDOW,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createSlidingWindow(config.get<string>('REDIS_URL')),
    },
    FraudEngineService,
    { provide: FRAUD_CHECK_SERVICE, useClass: RuleEngineFraudCheckService },
    { provide: FRAUD_SIGNAL_HOOK, useClass: RuleEngineFraudSignalHook },
  ],
  exports: [FRAUD_CHECK_SERVICE, FRAUD_SIGNAL_HOOK, FraudEngineService],
})
export class FraudModule {}
