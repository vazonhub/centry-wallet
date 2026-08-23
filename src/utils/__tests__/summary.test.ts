import type { Transaction } from '@models';

import { type BudgetPlan } from '../budget';
import { computeAllowance, firstActivityLocalDay } from '../summary';

const plan = (over: Partial<BudgetPlan> = {}): BudgetPlan => ({
  period: 'month',
  amountMinor: 0,
  currency: 'BYN',
  ...over,
});

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  accountId: 'a1',
  categoryId: null,
  kind: 'expense',
  amountMinor: -100,
  currency: 'BYN',
  rateToBaseE6: 1_000_000,
  note: null,
  occurredAt: 0,
  localDay: '2026-08-20',
  transferPairId: null,
  authorId: 'me',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  ...over,
});

describe('firstActivityLocalDay', () => {
  it('returns the earliest activity day inside the period', () => {
    const recent = [
      tx({ id: 'a', localDay: '2026-08-20' }),
      tx({ id: 'b', localDay: '2026-08-10' }),
      tx({ id: 'c', localDay: '2026-08-15' }),
    ];
    expect(firstActivityLocalDay(recent, '2026-08-01', '2026-08-20')).toBe('2026-08-10');
  });

  it('ignores days before the period start and after today', () => {
    const recent = [
      tx({ id: 'old', localDay: '2026-07-30' }), // before period
      tx({ id: 'future', localDay: '2026-08-25' }), // after today
      tx({ id: 'in', localDay: '2026-08-12' }),
    ];
    expect(firstActivityLocalDay(recent, '2026-08-01', '2026-08-20')).toBe('2026-08-12');
  });

  it('is null when there is no activity in the period', () => {
    expect(firstActivityLocalDay([], '2026-08-01', '2026-08-20')).toBeNull();
  });
});

describe('computeAllowance — "можно сегодня" (shared by home + widget)', () => {
  // Fixed clock: 2026-08-20 (August has 31 days; day-of-month 20).
  const now = new Date(2026, 7, 20);

  it('spreads the plan over the whole month when tracking from day 1', () => {
    const a = computeAllowance({
      // Month plan 310.00 BYN; activity from Aug 1 anchors the full 31 days.
      plan: plan({ period: 'month', amountMinor: 310_00, currency: 'BYN' }),
      recent: [
        tx({ id: 't0', localDay: '2026-08-01', amountMinor: 0, kind: 'income' }),
        tx({ id: 't1', localDay: '2026-08-20', amountMinor: -3_00 }),
        tx({ id: 't2', localDay: '2026-08-10', amountMinor: -7_00 }),
      ],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.daysInPeriod).toBe(31); // Aug 1 → Aug 31
    expect(a.daysLeft).toBe(12); // 31 − 20 + 1
    expect(a.perDayMinor).toBe(10_00); // 310.00 / 31
    expect(a.todaySpentMinor).toBe(3_00); // only the 2026-08-20 expense
    expect(a.periodSpentMinor).toBe(10_00); // both August expenses
    expect(a.periodStartLocalDay).toBe('2026-08-01');
    expect(a.configured).toBe(true);
    // carry = perDay(1000) × elapsed(20) − periodSpent(1000)
    expect(a.carryMinor).toBe(10_00 * 20 - 10_00);
  });

  it('spreads the plan over the REMAINING days on a fresh mid-month launch', () => {
    // No earlier data → anchor is today (Aug 20); only Aug 20..31 count (12 days).
    const a = computeAllowance({
      plan: plan({ period: 'month', amountMinor: 120_00, currency: 'BYN' }),
      recent: [tx({ id: 't1', localDay: '2026-08-20', amountMinor: -3_00 })],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.periodStartLocalDay).toBe('2026-08-20'); // anchored to today
    expect(a.daysInPeriod).toBe(12); // Aug 20 → Aug 31
    expect(a.daysLeft).toBe(12);
    expect(a.perDayMinor).toBe(10_00); // 120.00 / 12
    expect(a.periodSpentMinor).toBe(3_00);
    // No phantom surplus: elapsed = 1 day → carry = 1000·1 − 300 = 700.
    expect(a.carryMinor).toBe(10_00 - 3_00);
  });

  it('anchors to the first recorded day when data starts mid-period', () => {
    // Data from Aug 10 → anchor Aug 10; Aug 10..31 = 22 days.
    const a = computeAllowance({
      plan: plan({ period: 'month', amountMinor: 220_00, currency: 'BYN' }),
      recent: [
        tx({ id: 't1', localDay: '2026-08-10', amountMinor: -5_00 }),
        tx({ id: 't2', localDay: '2026-08-20', amountMinor: -4_00 }),
      ],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.periodStartLocalDay).toBe('2026-08-10');
    expect(a.daysInPeriod).toBe(22); // Aug 10 → Aug 31
    expect(a.perDayMinor).toBe(10_00); // 220.00 / 22
    expect(a.periodSpentMinor).toBe(9_00); // 5.00 + 4.00 since Aug 10
    // elapsed = Aug 10..20 = 11 days → carry = 1000·11 − 900 = 10100.
    expect(a.carryMinor).toBe(10_00 * 11 - 9_00);
  });

  it('spreads a weekly plan across the remaining days of the week', () => {
    // 2026-08-20 is a Thursday, no activity → anchor today, Thu..Sun = 4 days.
    const a = computeAllowance({
      plan: plan({ period: 'week', amountMinor: 40_00, currency: 'BYN' }),
      recent: [],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.daysInPeriod).toBe(4); // Thu..Sun
    expect(a.daysLeft).toBe(4);
    expect(a.perDayMinor).toBe(10_00); // 40.00 / 4
    expect(a.periodStartLocalDay).toBe('2026-08-20');
  });

  it('converts a foreign-currency plan to base via its rate', () => {
    const a = computeAllowance({
      // Plan 100.00 USD, 1 USD = 3.00 BYN → 300.00 BYN; activity from Aug 1 → /31.
      plan: plan({ period: 'month', amountMinor: 100_00, currency: 'USD' }),
      recent: [tx({ id: 'seed', localDay: '2026-08-01', amountMinor: 0, kind: 'income' })],
      base: 'BYN',
      rates: { USD: 3_000_000 },
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.configured).toBe(true);
    expect(a.expectedBaseMinor).toBe(300_00);
    expect(a.daysInPeriod).toBe(31);
    expect(a.perDayMinor).toBe(9_67); // trunc(300.00 / 31)
  });

  it('is unconfigured with a zero limit when no plan is set', () => {
    const a = computeAllowance({
      plan: plan({ amountMinor: 0 }),
      recent: [tx({ amountMinor: -3_00 })],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.configured).toBe(false);
    expect(a.perDayMinor).toBe(0);
    expect(a.todaySpentMinor).toBe(3_00); // spending still tracked
  });

  it('excludes transfers and income from today-spent', () => {
    const a = computeAllowance({
      plan: plan({ amountMinor: 310_00, currency: 'BYN' }),
      recent: [
        tx({ id: 't1', kind: 'transfer', amountMinor: -50_00, localDay: '2026-08-20' }),
        tx({ id: 't2', kind: 'income', amountMinor: 50_00, localDay: '2026-08-20' }),
      ],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.todaySpentMinor).toBe(0); // transfers/income are not spending
  });
});
