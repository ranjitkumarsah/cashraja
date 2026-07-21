import { randomUUID } from 'node:crypto';
import { FraudSeverity } from '@prisma/client';
import { FraudEngineService } from './fraud-engine.service';
import { FRAUD_RULES } from './fraud-rules';
import { RuleEngineFraudSignalHook } from './rule-engine-fraud-signal.hook';

/** Records the engine calls the hook makes (persistence tested separately). */
class RecordingEngine {
  readonly single: Array<{ userId: string; rule: string; severity: FraudSeverity }> = [];
  readonly many: Array<{ userIds: string[]; rule: string; severity: FraudSeverity }> = [];

  async raiseFlag(input: { userId: string; rule: string; severity: FraudSeverity }): Promise<string | null> {
    this.single.push(input);
    return 'flag-id';
  }

  async raiseForMany(userIds: string[], rule: string, severity: FraudSeverity): Promise<void> {
    this.many.push({ userIds, rule, severity });
  }
}

function build(engine: RecordingEngine): RuleEngineFraudSignalHook {
  return new RuleEngineFraudSignalHook(engine as unknown as FraudEngineService);
}

describe('RuleEngineFraudSignalHook', () => {
  let engine: RecordingEngine;
  let hook: RuleEngineFraudSignalHook;

  beforeEach(() => {
    engine = new RecordingEngine();
    hook = build(engine);
  });

  it('rule 4 — game_farming opens a single medium flag for the farming account', async () => {
    const userId = randomUUID();
    await hook.report({ userId, rule: 'game_farming', details: { elapsedSeconds: 1 } });
    expect(engine.single).toHaveLength(1);
    expect(engine.single[0]).toMatchObject({
      userId,
      rule: FRAUD_RULES.GAME_FARMING,
      severity: FraudSeverity.medium,
    });
  });

  it('rule 3 — self_referral flags BOTH referrer and referred', async () => {
    const referredId = randomUUID();
    const referrerId = randomUUID();
    await hook.report({ userId: referredId, rule: 'self_referral', details: { referrerId } });
    expect(engine.many).toHaveLength(1);
    expect(engine.many[0].rule).toBe(FRAUD_RULES.SELF_REFERRAL);
    expect(engine.many[0].userIds).toEqual(expect.arrayContaining([referredId, referrerId]));
  });

  it('self_referral without a referrerId flags just the subject', async () => {
    const userId = randomUUID();
    await hook.report({ userId, rule: 'self_referral', details: {} });
    expect(engine.many[0].userIds).toEqual([userId]);
  });

  it('an unknown signal is recorded low-severity, never dropped', async () => {
    const userId = randomUUID();
    await hook.report({ userId, rule: 'something_new' });
    expect(engine.single).toHaveLength(1);
    expect(engine.single[0]).toMatchObject({ rule: 'something_new', severity: FraudSeverity.low });
  });
});
