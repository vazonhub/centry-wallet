import { daysInclusive, defaultBudgetPlan, effectivePeriod, periodBounds } from '../budget';

describe('periodBounds — calendar week / month', () => {
  it('a Thursday sits mid-week with a Monday start', () => {
    // 2026-08-20 is a Thursday.
    const b = periodBounds('week', new Date(2026, 7, 20));
    expect(b.startLocalDay).toBe('2026-08-17'); // Monday
    expect(b.daysInPeriod).toBe(7);
    expect(b.daysElapsed).toBe(4); // Mon..Thu
    expect(b.daysLeft).toBe(4); // Thu..Sun
    expect(b.daysElapsed + b.daysLeft - 1).toBe(b.daysInPeriod);
  });

  it('a Monday is the first day of its week', () => {
    const b = periodBounds('week', new Date(2026, 7, 17));
    expect(b.startLocalDay).toBe('2026-08-17');
    expect(b.daysElapsed).toBe(1);
    expect(b.daysLeft).toBe(7);
  });

  it('a Sunday is the last day of its week', () => {
    const b = periodBounds('week', new Date(2026, 7, 23));
    expect(b.startLocalDay).toBe('2026-08-17');
    expect(b.daysElapsed).toBe(7);
    expect(b.daysLeft).toBe(1);
  });

  it('month bounds start on the 1st and span the whole month', () => {
    const b = periodBounds('month', new Date(2026, 7, 20)); // August = 31 days
    expect(b.startLocalDay).toBe('2026-08-01');
    expect(b.endLocalDay).toBe('2026-08-31');
    expect(b.daysInPeriod).toBe(31);
    expect(b.daysElapsed).toBe(20);
    expect(b.daysLeft).toBe(12);
  });

  it('handles February in a leap year', () => {
    const b = periodBounds('month', new Date(2028, 1, 10)); // Feb 2028 = 29 days
    expect(b.endLocalDay).toBe('2028-02-29');
    expect(b.daysInPeriod).toBe(29);
    expect(b.daysElapsed).toBe(10);
    expect(b.daysLeft).toBe(20);
  });

  it('reports the week end (Sunday) for a mid-week day', () => {
    const b = periodBounds('week', new Date(2026, 7, 20)); // Thursday
    expect(b.startLocalDay).toBe('2026-08-17');
    expect(b.endLocalDay).toBe('2026-08-23'); // Sunday
  });
});

describe('daysInclusive', () => {
  it('counts both endpoints', () => {
    expect(daysInclusive('2026-08-10', '2026-08-10')).toBe(1);
    expect(daysInclusive('2026-08-10', '2026-08-31')).toBe(22);
  });

  it('crosses a month boundary correctly', () => {
    expect(daysInclusive('2026-08-30', '2026-09-02')).toBe(4);
  });
});

describe('effectivePeriod — narrow to what the user tracks', () => {
  const bounds = periodBounds('month', new Date(2026, 7, 20)); // Aug: 01..31

  it('uses the first activity day as the anchor', () => {
    const e = effectivePeriod(bounds, '2026-08-10', '2026-08-20');
    expect(e.startLocalDay).toBe('2026-08-10');
    expect(e.daysInPeriod).toBe(22); // Aug 10 → Aug 31
    expect(e.daysElapsed).toBe(11); // Aug 10 → Aug 20
  });

  it('falls back to today when there is no activity', () => {
    const e = effectivePeriod(bounds, null, '2026-08-20');
    expect(e.startLocalDay).toBe('2026-08-20');
    expect(e.daysInPeriod).toBe(12); // Aug 20 → Aug 31
    expect(e.daysElapsed).toBe(1);
  });

  it('clamps an out-of-range anchor into [periodStart, today]', () => {
    // Activity claimed before the period start is clamped up to the start.
    const before = effectivePeriod(bounds, '2026-07-01', '2026-08-20');
    expect(before.startLocalDay).toBe('2026-08-01');
    // Activity after today (should not happen) is clamped down to today.
    const after = effectivePeriod(bounds, '2026-08-25', '2026-08-20');
    expect(after.startLocalDay).toBe('2026-08-20');
  });
});

describe('defaultBudgetPlan', () => {
  it('defaults to an unset monthly plan in the base currency', () => {
    expect(defaultBudgetPlan('USD')).toEqual({ period: 'month', amountMinor: 0, currency: 'USD' });
  });
});
