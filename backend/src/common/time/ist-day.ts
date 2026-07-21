/**
 * IST (Asia/Kolkata, UTC+5:30, no DST) calendar-day helpers.
 *
 * Streaks and daily caps are evaluated against the Indian civil day, not UTC.
 * Because IST has no daylight-saving transitions a fixed +5:30 offset is exact,
 * so we avoid a timezone library and keep the math dependency-free and testable.
 */

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** IST calendar date as `YYYY-MM-DD` for the given instant (default: now). */
export function istDateString(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST date string for the day before `at` (used for streak-continuation checks). */
export function istYesterdayString(at: Date = new Date()): string {
  return istDateString(new Date(at.getTime() - DAY_MS));
}

/**
 * UTC instant of IST-midnight that opens the IST day containing `at`. Used as
 * the lower bound for "today" queries (`createdAt >= istDayStartUtc()`).
 */
export function istDayStartUtc(at: Date = new Date()): Date {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const midnightIstMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(midnightIstMs - IST_OFFSET_MS);
}

/**
 * Convert an IST date string (`YYYY-MM-DD`) to the Date stored in a Postgres
 * `@db.Date` column (UTC-midnight of that calendar date), and back.
 */
export function istDateStringToDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/** Read the `YYYY-MM-DD` back from a `@db.Date` value (UTC-midnight). */
export function dateColumnToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}
