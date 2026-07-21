import {
  dateColumnToString,
  IST_OFFSET_MS,
  istDateString,
  istDateStringToDate,
  istDayStartUtc,
  istYesterdayString,
} from './ist-day';

describe('ist-day', () => {
  it('rolls the IST date over at 18:30 UTC (00:00 IST)', () => {
    // 2026-07-20T18:29:59Z is still 2026-07-20 in IST (23:59:59 IST)
    expect(istDateString(new Date('2026-07-20T18:29:59Z'))).toBe('2026-07-20');
    // 2026-07-20T18:30:00Z is 2026-07-21 00:00 IST
    expect(istDateString(new Date('2026-07-20T18:30:00Z'))).toBe('2026-07-21');
  });

  it('istDayStartUtc is the UTC instant of IST-midnight for that day', () => {
    const start = istDayStartUtc(new Date('2026-07-21T09:00:00Z')); // 14:30 IST
    expect(start.toISOString()).toBe('2026-07-20T18:30:00.000Z'); // 00:00 IST of 2026-07-21
    expect(IST_OFFSET_MS).toBe((5 * 60 + 30) * 60 * 1000);
  });

  it('yesterday is exactly one IST day before', () => {
    expect(istYesterdayString(new Date('2026-07-21T12:00:00Z'))).toBe('2026-07-20');
  });

  it('round-trips an IST date string through the @db.Date representation', () => {
    const d = istDateStringToDate('2026-07-21');
    expect(d.toISOString()).toBe('2026-07-21T00:00:00.000Z');
    expect(dateColumnToString(d)).toBe('2026-07-21');
  });
});
