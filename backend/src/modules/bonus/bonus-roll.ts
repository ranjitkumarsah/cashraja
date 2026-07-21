import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';

/** One prize slot in a server-side weighted probability table. */
export interface PrizeEntry {
  coins: number;
  weight: number;
}

/**
 * DI token for the entropy source. Real binding uses node:crypto randomInt
 * (CSPRNG); unit tests inject a deterministic function to assert a specific
 * prize is selected. `Math.random` is never used.
 */
export const BONUS_RANDOM_INT = 'BONUS_RANDOM_INT';
export type RandomIntFn = (maxExclusive: number) => number;

/** Default entropy: cryptographically-strong integer in [0, maxExclusive). */
export const cryptoRandomInt: RandomIntFn = (maxExclusive: number): number =>
  randomInt(maxExclusive);

/**
 * Weighted pick over the table using the injected entropy. The roll is purely
 * server-side — the client cannot influence which prize is selected. Draws an
 * integer in [0, totalWeight) and walks the cumulative weights.
 */
export function rollWeighted(table: PrizeEntry[], rnd: RandomIntFn): number {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return 0;
  let ticket = rnd(total);
  for (const entry of table) {
    if (ticket < entry.weight) return entry.coins;
    ticket -= entry.weight;
  }
  // Unreachable when weights sum to `total`; return the last slot defensively.
  return table[table.length - 1].coins;
}

/** Validate + parse a bonus_config.weighted_table jsonb value into prize slots. */
export function parseWeightedTable(value: Prisma.JsonValue): PrizeEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('bonus weighted_table must be a JSON array');
  }
  const table: PrizeEntry[] = [];
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('bonus weighted_table entry must be an object');
    }
    const record = raw as Record<string, unknown>;
    const coins = record.coins;
    const weight = record.weight;
    if (
      typeof coins !== 'number' ||
      !Number.isInteger(coins) ||
      coins < 0 ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight <= 0
    ) {
      throw new Error('bonus weighted_table entry needs coins>=0 and weight>0');
    }
    table.push({ coins, weight });
  }
  if (table.length === 0) {
    throw new Error('bonus weighted_table must not be empty');
  }
  return table;
}
