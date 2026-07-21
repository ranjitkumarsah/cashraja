import { Injectable, Logger } from '@nestjs/common';

/**
 * Detection HOOK for suspicious engagement events (TRD §5: game round farming,
 * self-referral). Phase D fires signals at the point of detection; Phase E's
 * rule engine binds the real implementation behind this token to open
 * fraud_flags / apply auto-actions. The Phase D stub only logs — it never
 * blocks the request path (the caller has already applied its own rejection,
 * e.g. a too-fast round is refused before this fires).
 */

export interface FraudSignal {
  userId: string;
  /** stable rule id, e.g. 'game_farming' | 'self_referral' */
  rule: string;
  details?: Record<string, unknown>;
}

export interface FraudSignalHook {
  report(signal: FraudSignal): Promise<void>;
}

export const FRAUD_SIGNAL_HOOK = 'FRAUD_SIGNAL_HOOK';

/** Phase D stub: logs at warn level. Replaced by the rule engine in Phase E. */
@Injectable()
export class LoggingFraudSignalHook implements FraudSignalHook {
  private readonly logger = new Logger(LoggingFraudSignalHook.name);

  async report(signal: FraudSignal): Promise<void> {
    this.logger.warn(
      `fraud signal (stub): rule=${signal.rule} user=${signal.userId}` +
        (signal.details ? ` details=${JSON.stringify(signal.details)}` : ''),
    );
  }
}
