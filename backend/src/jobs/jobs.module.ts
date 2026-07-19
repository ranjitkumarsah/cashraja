import { Module } from '@nestjs/common';
import { LedgerReconciliationJob } from './ledger-reconciliation.job';

/**
 * Scheduled/background jobs. BullMQ workers (postback processing, notification
 * fan-out) land here in phase B; for now only the cron-based reconciliation.
 */
@Module({
  providers: [LedgerReconciliationJob],
  exports: [LedgerReconciliationJob],
})
export class JobsModule {}
