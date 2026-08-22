import type { Transaction } from '@models';

import { type BudgetPlan } from '../budget';
import { computeAllowance } from '../summary';

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

describe('computeAllowance — "можно сегодня" (shared by home + widget)', () => {
  // Fixed clock: 2026-08-20 (August has 31 days; day-of-month 20).
  const now = new Date(2026, 7, 20);

  it('daily limit = planned spend ÷ days in the calendar period', () => {
    const a = computeAllowance({
      // Month plan 310.00 BYN over 31 days → 10.00/day.
      plan: plan({ period: 'month', amountMinor: 310_00, currency: 'BYN' }),
      recent: [
        tx({ id: 't1', localDay: '2026-08-20', amountMinor: -3_00 }),
        tx({ id: 't2', localDay: '2026-08-10', amountMinor: -7_00 }),
      ],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.daysInPeriod).toBe(31);
    expect(a.daysLeft).toBe(12); // 31 − 20 + 1
    expect(a.perDayMinor).toBe(10_00); // 310.00 / 31
    expect(a.todaySpentMinor).toBe(3_00); // only the 2026-08-20 expense
    expect(a.periodSpentMinor).toBe(10_00); // both August expenses
    expect(a.periodStartLocalDay).toBe('2026-08-01');
    expect(a.configured).toBe(true);
    // carry = perDay(1000) × elapsed(20) − periodSpent(1000)
    expect(a.carryMinor).toBe(10_00 * 20 - 10_00);
  });

  it('spreads a weekly plan across 7 days from Monday', () => {
    // 2026-08-20 is a Thursday → since Monday = 3, elapsed 4, daysLeft 4.
    const a = computeAllowance({
      plan: plan({ period: 'week', amountMinor: 70_00, currency: 'BYN' }),
      recent: [],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.daysInPeriod).toBe(7);
    expect(a.daysLeft).toBe(4);
    expect(a.perDayMinor).toBe(10_00); // 70.00 / 7
    expect(a.periodStartLocalDay).toBe('2026-08-17'); // Monday
  });

  it('converts a foreign-currency plan to base via its rate', () => {
    const a = computeAllowance({
      // Plan 100.00 USD, 1 USD = 3.00 BYN → 300.00 BYN over 31 days.
      plan: plan({ period: 'month', amountMinor: 100_00, currency: 'USD' }),
      recent: [],
      base: 'BYN',
      rates: { USD: 3_000_000 },
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.configured).toBe(true);
    expect(a.expectedBaseMinor).toBe(300_00);
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
