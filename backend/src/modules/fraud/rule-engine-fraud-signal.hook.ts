import { Injectable } from '@nestjs/common';
import { FraudSeverity } from '@prisma/client';
import { FraudEngineService } from './fraud-engine.service';
import { FRAUD_RULES, SIGNAL_RULE_ALIASES } from './fraud-rules';
import { FraudSignal, FraudSignalHook } from './fraud-signal.hook';

/**
 * E1 — real engagement signal hook bound behind FRAUD_SIGNAL_HOOK (replaces the
 * Phase-D log-only stub). Detection already happened at the call site (a too-fast
 * game round is refused before this fires; a self-referral bonus is blocked in
 * ReferralService); this persists the durable fraud_flag and applies the
 * configured auto-action so the event surfaces in the admin queue.
 *
 * Rule 3 (self-referral) flags BOTH the referrer and the referred account.
 * Rule 4 (game round farming) flags the farming account.
 */
@Injectable()
export class RuleEngineFraudSignalHook implements FraudSignalHook {
  constructor(private readonly engine: FraudEngineService) {}

  async report(signal: FraudSignal): Promise<void> {
    const rule = SIGNAL_RULE_ALIASES[signal.rule] ?? signal.rule;

    if (rule === FRAUD_RULES.SELF_REFERRAL) {
      const referrerId = this.referrerIdOf(signal);
      const affected = referrerId ? [signal.userId, referrerId] : [signal.userId];
      await this.engine.raiseForMany(
        affected,
        FRAUD_RULES.SELF_REFERRAL,
        FraudSeverity.medium,
        signal.details,
      );
      return;
    }

    if (rule === FRAUD_RULES.GAME_FARMING) {
      await this.engine.raiseFlag({
        userId: signal.userId,
        rule: FRAUD_RULES.GAME_FARMING,
        severity: FraudSeverity.medium,
        details: signal.details,
      });
      return;
    }

    // Unknown signal: record it low-severity so nothing is silently dropped.
    await this.engine.raiseFlag({
      userId: signal.userId,
      rule,
      severity: FraudSeverity.low,
      details: signal.details,
    });
  }

  private referrerIdOf(signal: FraudSignal): string | undefined {
    const raw = signal.details?.['referrerId'];
    return typeof raw === 'string' ? raw : undefined;
  }
}
