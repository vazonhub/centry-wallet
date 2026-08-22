import { defaultBudgetPlan, periodBounds, periodLabel } from '../budget';

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
    expect(b.daysInPeriod).toBe(31);
    expect(b.daysElapsed).toBe(20);
    expect(b.daysLeft).toBe(12);
  });

  it('handles February in a leap year', () => {
    const b = periodBounds('month', new Date(2028, 1, 10)); // Feb 2028 = 29 days
    expect(b.daysInPeriod).toBe(29);
    expect(b.daysElapsed).toBe(10);
    expect(b.daysLeft).toBe(20);
  });
});

describe('defaultBudgetPlan / periodLabel', () => {
  it('defaults to an unset monthly plan in the base currency', () => {
    expect(defaultBudgetPlan('USD')).toEqual({ period: 'month', amountMinor: 0, currency: 'USD' });
  });

  it('labels periods in Russian accusative', () => {
    expect(periodLabel('week')).toBe('неделю');
    expect(periodLabel('month')).toBe('месяц');
  });
});
