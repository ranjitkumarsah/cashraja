import { randomUUID } from 'node:crypto';

/**
 * Shared lightweight fakes for the Phase D engagement unit suites (game,
 * streak, bonus). They faithfully simulate the two behaviors those services
 * rely on: ledger idempotency (a repeated idempotency_key is a no-op returning
 * the original entry) and write-through balances (entry.balanceAfter).
 */

export interface FakeLedgerEntry {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
}

export interface FakeRecordParams {
  userId: string;
  amount: number;
  sourceType: string;
  sourceRefId?: string;
  idempotencyKey: string;
}

/** Idempotency-aware, balance-tracking stand-in for LedgerService. */
export class FakeEngagementLedger {
  readonly balances = new Map<string, number>();
  readonly calls: FakeRecordParams[] = [];
  private readonly byKey = new Map<string, FakeLedgerEntry>();

  seed(userId: string, amount: number): void {
    this.balances.set(userId, amount);
  }

  async record(params: FakeRecordParams): Promise<{ entry: FakeLedgerEntry; duplicate: boolean }> {
    const existing = this.byKey.get(params.idempotencyKey);
    if (existing) {
      return { entry: existing, duplicate: true };
    }
    if (!Number.isInteger(params.amount) || params.amount === 0) {
      throw new Error(`FakeEngagementLedger: non-zero integer required, got ${params.amount}`);
    }
    const balanceAfter = (this.balances.get(params.userId) ?? 0) + params.amount;
    this.balances.set(params.userId, balanceAfter);
    const entry: FakeLedgerEntry = {
      id: randomUUID(),
      userId: params.userId,
      amount: params.amount,
      balanceAfter,
    };
    this.byKey.set(params.idempotencyKey, entry);
    this.calls.push(params);
    return { entry, duplicate: false };
  }

  async getCachedBalance(userId: string): Promise<number> {
    return this.balances.get(userId) ?? 0;
  }
}

/** In-memory AppConfigService: get / getNumber over a key→value-object map. */
export class FakeAppConfig {
  private readonly values = new Map<string, unknown>();

  set(key: string, value: unknown): this {
    this.values.set(key, value);
    return this;
  }

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async getNumber(key: string, field: string, fallback: number): Promise<number> {
    const value = this.values.get(key);
    if (value !== null && typeof value === 'object') {
      const raw = (value as Record<string, unknown>)[field];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    }
    return fallback;
  }
}

/** Records referral fan-out invocations (the real service is tested separately). */
export class RecordingReferral {
  readonly calls: Array<{ userId: string; amount: number; sourceLedgerId: string }> = [];

  async onUserEarned(params: {
    userId: string;
    amount: number;
    sourceLedgerId: string;
  }): Promise<void> {
    this.calls.push(params);
  }
}

/** Records post-credit notifications fired by the engagement services. */
export class RecordingNotificationHook {
  readonly credited: Array<{
    userId: string;
    coins: number;
    sourceType: string;
    sourceRefId: string;
  }> = [];

  async onCredited(notification: {
    userId: string;
    coins: number;
    sourceType: string;
    sourceRefId: string;
  }): Promise<void> {
    this.credited.push(notification);
  }
}

/** Records fraud detection signals fired by the engagement services. */
export class RecordingFraudSignal {
  readonly signals: Array<{ userId: string; rule: string; details?: Record<string, unknown> }> = [];

  async report(signal: {
    userId: string;
    rule: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    this.signals.push(signal);
  }
}
