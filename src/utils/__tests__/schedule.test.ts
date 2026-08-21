import {
  currentPeriod,
  daysElapsedInPeriod,
  daysInPeriod,
  daysUntilPayday,
  expectedForPeriod,
  nextPaydayDate,
  periodStartLocalDay,
  scheduleSlots,
  type PayoutSchedule,
  type PayoutSlotValue,
} from '../schedule';

const monthly = (day: number, amounts: Record<string, PayoutSlotValue> = {}): PayoutSchedule => ({
  frequency: 'monthly',
  weekday: 5,
  anchor: null,
  days: [day],
  amounts,
});

const semimonthly = (
  d1: number,
  d2: number,
  amounts: Record<string, PayoutSlotValue> = {},
): PayoutSchedule => ({
  frequency: 'semimonthly',
  weekday: 5,
  anchor: null,
  days: [d1, d2],
  amounts,
});

const byn = (minor: number): PayoutSlotValue => ({ minor, currency: 'BYN' });

describe('schedule — monthly', () => {
  const now = new Date(2026, 7, 20); // 2026-08-20

  it('period runs from the payday to the next payday', () => {
    const p = currentPeriod(monthly(29), now);
    expect(periodStartLocalDay(monthly(29), now)).toBe('2026-07-29');
    expect(p.end.getFullYear()).toBe(2026);
    expect(p.end.getMonth()).toBe(7); // August
    expect(p.end.getDate()).toBe(29);
    expect(daysInPeriod(monthly(29), now)).toBe(31); // Jul 29 → Aug 29
    expect(daysUntilPayday(monthly(29), now)).toBe(9); // Aug 20 → Aug 29
    expect(daysElapsedInPeriod(monthly(29), now)).toBe(22); // Jul 29 → Aug 20
  });

  it('expected amount comes from the start slot', () => {
    expect(expectedForPeriod(monthly(29, { '29': byn(2000_00) }), now)?.minor).toBe(2000_00);
    expect(expectedForPeriod(monthly(29), now)).toBeNull();
  });

  it('clamps a day past the month length (31 → Feb 28)', () => {
    const feb = new Date(2026, 1, 15); // 2026-02-15
    const next = nextPaydayDate(monthly(31), feb);
    expect(next.getMonth()).toBe(1); // February
    expect(next.getDate()).toBe(28); // clamped
  });
});

describe('schedule — semimonthly', () => {
  it('uses the nearer slot and its amount', () => {
    const s = semimonthly(10, 25, { '10': byn(800_00), '25': byn(2000_00) });
    const mid = new Date(2026, 7, 20); // between 10 and 25 → period [10,25], slot 10
    expect(periodStartLocalDay(s, mid)).toBe('2026-08-10');
    expect(daysInPeriod(s, mid)).toBe(15);
    expect(expectedForPeriod(s, mid)?.minor).toBe(800_00);

    const late = new Date(2026, 7, 27); // after 25 → period [25, next 10], slot 25
    expect(periodStartLocalDay(s, late)).toBe('2026-08-25');
    expect(expectedForPeriod(s, late)?.minor).toBe(2000_00);
    expect(nextPaydayDate(s, late).getDate()).toBe(10);
  });

  it('exposes both slots for the picker', () => {
    expect(scheduleSlots(semimonthly(10, 25)).map((x) => x.id)).toEqual(['10', '25']);
  });
});

describe('schedule — weekly / biweekly', () => {
  it('weekly period is 7 days ending on the chosen weekday', () => {
    const s: PayoutSchedule = {
      frequency: 'weekly',
      weekday: 5,
      anchor: null,
      days: [],
      amounts: {},
    };
    const wed = new Date(2026, 7, 19); // Wednesday
    expect(daysInPeriod(s, wed)).toBe(7);
    expect(nextPaydayDate(s, wed).getDay()).toBe(5); // Friday
  });

  it('biweekly aligns to the anchor with a 14-day step', () => {
    const s: PayoutSchedule = {
      frequency: 'biweekly',
      weekday: 5,
      anchor: '2026-08-07', // a Friday
      days: [],
      amounts: {},
    };
    expect(daysInPeriod(s, new Date(2026, 7, 15))).toBe(14);
    // 2026-08-15 is within [08-07, 08-21)
    expect(periodStartLocalDay(s, new Date(2026, 7, 15))).toBe('2026-08-07');
    expect(nextPaydayDate(s, new Date(2026, 7, 15)).getDate()).toBe(21);
  });

  it('weekly slot picker has one entry', () => {
    const s: PayoutSchedule = {
      frequency: 'weekly',
      weekday: 1,
      anchor: null,
      days: [],
      amounts: {},
    };
    expect(scheduleSlots(s)).toHaveLength(1);
    expect(scheduleSlots(s)[0]?.id).toBe('w');
  });
});
