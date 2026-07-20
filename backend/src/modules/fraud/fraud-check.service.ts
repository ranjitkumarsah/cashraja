import { Injectable } from '@nestjs/common';

/**
 * Fraud pre-check hook on the credit path (TRD §5, ARCHITECTURE_PLAN §2.4).
 *
 * Phase B ships the interface + a pass-through stub; Phase E replaces the
 * binding with the real rule engine (Redis sliding-window velocity, device
 * multi-account, ...). A 'hold' verdict keeps the offer_completion pending
 * with the reason stored in status_reason — no ledger write happens.
 */

export interface FraudCheckInput {
  userId: string;
  sourceType: 'offer' | 'ad';
  network: string;
  externalTxnId: string;
  coins: number;
}

export type FraudVerdict = { verdict: 'allow' } | { verdict: 'hold'; reason: string };

export interface FraudCheckService {
  checkCredit(input: FraudCheckInput): Promise<FraudVerdict>;
}

export const FRAUD_CHECK_SERVICE = 'FRAUD_CHECK_SERVICE';

/** Phase B stub: every credit passes. Replaced by the rule engine in Phase E. */
@Injectable()
export class PassThroughFraudCheckService implements FraudCheckService {
  async checkCredit(_input: FraudCheckInput): Promise<FraudVerdict> {
    return { verdict: 'allow' };
  }
}
