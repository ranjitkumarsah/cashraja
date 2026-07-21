import { FraudAutoAction, FraudSeverity } from '@prisma/client';

/**
 * Stable rule ids persisted in fraud_flags.rule_triggered (TRD §5). The admin
 * fraud queue groups/filters on these, and notifications/analytics key off them.
 */
export const FRAUD_RULES = {
  MULTI_ACCOUNT: 'same_device_multi_account',
  OFFER_VELOCITY: 'offer_velocity_exceeded',
  SELF_REFERRAL: 'self_referral',
  GAME_FARMING: 'game_round_farming',
  REDEMPTION_ABUSE: 'new_account_redemption_abuse',
} as const;

export type FraudRuleId = (typeof FRAUD_RULES)[keyof typeof FRAUD_RULES];

/** Phase-D signal rule ids (fired by game/referral) mapped to durable rule ids. */
export const SIGNAL_RULE_ALIASES: Record<string, FraudRuleId> = {
  game_farming: FRAUD_RULES.GAME_FARMING,
  self_referral: FRAUD_RULES.SELF_REFERRAL,
};

/** app_config keys (all additive; defaults live in code so tests need no seed). */
export const FRAUD_CONFIG = {
  /** {flag_over, block_over} — device→account fan-out thresholds. */
  DEVICE_LIMITS: 'fraud.device_account_limits',
  /** {max_completions, window_minutes} — offer-completion velocity window. */
  OFFER_VELOCITY: 'fraud.offer_velocity',
  /** {low, medium, high} → FraudAutoAction name — severity→auto-action map. */
  SEVERITY_ACTIONS: 'fraud.severity_actions',
  /** {hours} — account age under which a max-value redemption is force-reviewed. */
  REDEMPTION_MIN_AGE: 'redemption.min_account_age_hours',
} as const;

export const FRAUD_DEFAULTS = {
  deviceFlagOver: 2,
  deviceBlockOver: 3,
  // Abuse threshold: a genuine user completing many small offers in a burst is
  // normal; >20 credited offer completions inside 10 minutes is the signal.
  offerMaxCompletions: 20,
  offerWindowMinutes: 10,
  redemptionMinAgeHours: 72,
  severityActions: {
    low: FraudAutoAction.none,
    medium: FraudAutoAction.flagged_for_review,
    high: FraudAutoAction.auto_banned,
  } as Record<FraudSeverity, FraudAutoAction>,
} as const;

/**
 * A single fraud rule evaluated at a hook point. Rules are pure detectors: they
 * read state (Redis window / Prisma) and return a verdict; persistence and
 * auto-actions are the engine's job (single writer to fraud_flags).
 */
export interface FraudRuleResult {
  triggered: boolean;
  severity: FraudSeverity;
  /** short machine reason surfaced on a held credit / logged with the flag */
  reason?: string;
  details?: Record<string, unknown>;
  /** additional user ids to flag beyond the subject (multi-account fan-out) */
  additionalUserIds?: string[];
  /** when true, the credit hook should HOLD the credit (stay pending) */
  hold?: boolean;
}

export function ruleNotTriggered(severity: FraudSeverity = FraudSeverity.low): FraudRuleResult {
  return { triggered: false, severity };
}

/** Resolve a configured severity→action map into a concrete FraudAutoAction. */
export function autoActionFor(
  severity: FraudSeverity,
  map: Record<string, unknown> | undefined,
): FraudAutoAction {
  const raw = map?.[severity];
  if (typeof raw === 'string' && isFraudAutoAction(raw)) {
    return raw;
  }
  return FRAUD_DEFAULTS.severityActions[severity];
}

function isFraudAutoAction(value: string): value is FraudAutoAction {
  return (Object.values(FraudAutoAction) as string[]).includes(value);
}
