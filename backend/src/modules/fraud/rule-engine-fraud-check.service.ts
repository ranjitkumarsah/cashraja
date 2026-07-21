import { Injectable, Logger } from '@nestjs/common';
import { FraudCheckInput, FraudCheckService, FraudVerdict } from './fraud-check.service';
import { FraudEngineService } from './fraud-engine.service';
import { FRAUD_RULES } from './fraud-rules';

/**
 * E1 — real credit-path pre-check bound behind FRAUD_CHECK_SERVICE (replaces the
 * Phase-B pass-through). Runs the two hot-path rules for a credit:
 *   - offer velocity (sliding window) → HOLD + flag on a burst,
 *   - device multi-accounting → flag all linked accounts (+ HOLD over block).
 * A `hold` verdict keeps the offer_completion pending (no ledger write); the
 * flag lands in the admin queue for review.
 */
@Injectable()
export class RuleEngineFraudCheckService implements FraudCheckService {
  private readonly logger = new Logger(RuleEngineFraudCheckService.name);

  constructor(private readonly engine: FraudEngineService) {}

  async checkCredit(input: FraudCheckInput): Promise<FraudVerdict> {
    let hold: string | undefined;

    // Rule 2 — offer velocity (offer credits only; ads have their own SSV caps).
    if (input.sourceType === 'offer') {
      const velocity = await this.engine.evaluateOfferVelocity(input.userId);
      if (velocity.triggered) {
        await this.engine.raiseFlag({
          userId: input.userId,
          rule: FRAUD_RULES.OFFER_VELOCITY,
          severity: velocity.severity,
          details: { ...velocity.details, network: input.network, externalTxnId: input.externalTxnId },
        });
        if (velocity.hold) hold = velocity.reason ?? 'offer_velocity_exceeded';
      }
    }

    // Rule 1 — device multi-accounting (both offer and ad credits).
    const multi = await this.engine.evaluateMultiAccount(input.userId);
    if (multi.triggered) {
      const affected = [input.userId, ...(multi.additionalUserIds ?? [])];
      await this.engine.raiseForMany(
        affected,
        FRAUD_RULES.MULTI_ACCOUNT,
        multi.severity,
        multi.details,
      );
      if (multi.hold) hold = hold ?? (multi.reason ?? 'same_device_multi_account');
    }

    if (hold) {
      this.logger.warn(`credit held for user ${input.userId}: ${hold}`);
      return { verdict: 'hold', reason: hold };
    }
    return { verdict: 'allow' };
  }
}
