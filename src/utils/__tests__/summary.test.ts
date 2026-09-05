import type { Account, Transaction } from '@models';

import { type BudgetPlan } from '../budget';
import { computeAllowance, firstActivityLocalDay, resolveSpendAccountIds } from '../summary';

const acc = (over: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: 'Main',
  currency: 'BYN',
  kind: 'card',
  icon: 'card',
  openingMinor: 0,
  sortOrder: 0,
  isDefault: true,
  targetMinor: null,
  color: null,
  closedAt: null,
  createdAt: 0,
  updatedAt: 0,
  archivedAt: null,
  ...over,
});

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
    expect(a.periodBudgetMinor).toBe(310_00); // full plan (nothing forfeited)
    expect(a.periodStartLocalDay).toBe('2026-08-01');
    expect(a.configured).toBe(true);
    // carry counts only fully-passed days (today excluded): perDay·(elapsed−1)
    // − (periodSpent − todaySpent) = 1000·19 − (1000 − 300) = 18300.
    expect(a.carryMinor).toBe(10_00 * 19 - (10_00 - 3_00));
  });

  it('forfeits the untracked days rather than inflating perDay on a mid-month launch', () => {
    // No earlier data → anchor is today (Aug 20); Aug 1..19 are forfeited.
    const a = computeAllowance({
      plan: plan({ period: 'month', amountMinor: 120_00, currency: 'BYN' }),
      recent: [tx({ id: 't1', localDay: '2026-08-20', amountMinor: -3_00 })],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });

    expect(a.periodStartLocalDay).toBe('2026-08-20'); // anchored to today
    expect(a.daysInPeriod).toBe(12); // Aug 20 → Aug 31 (tracked span)
    expect(a.daysLeft).toBe(12);
    expect(a.perDayMinor).toBe(3_87); // 120.00 / 31 (full calendar days), truncated
    expect(a.periodSpentMinor).toBe(3_00);
    // Budget = plan − forfeited pre-anchor days = 12000 − 387·19 = 4647.
    expect(a.periodBudgetMinor).toBe(46_47);
    // First tracking day → no phantom surplus.
    expect(a.carryMinor).toBe(0);
  });

  it('anchors to the first recorded day when data starts mid-period', () => {
    // Data from Aug 10 → anchor Aug 10; Aug 1..9 forfeited, Aug 10..31 tracked.
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
    expect(a.daysInPeriod).toBe(22); // Aug 10 → Aug 31 (tracked span)
    expect(a.perDayMinor).toBe(7_09); // 220.00 / 31 (full calendar days), truncated
    expect(a.periodSpentMinor).toBe(9_00); // 5.00 + 4.00 since Aug 10
    // Budget = 22000 − 709·9 = 15619.
    expect(a.periodBudgetMinor).toBe(156_19);
    // elapsed = Aug 10..20 = 11 days, today (Aug 20) excluded, spent-before = 5.00:
    // carry = 709·10 − 500 = 6590.
    expect(a.carryMinor).toBe(7_09 * 10 - 5_00);
  });

  it('keeps the natural daily rate for a weekly plan on a mid-week launch', () => {
    // 2026-08-20 is a Thursday, no activity → anchor today, Thu..Sun = 4 days.
    const a = computeAllowance({
      plan: plan({ period: 'week', amountMinor: 40_00, currency: 'BYN' }),
      recent: [],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.daysInPeriod).toBe(4); // Thu..Sun (tracked span)
    expect(a.daysLeft).toBe(4);
    expect(a.perDayMinor).toBe(5_71); // 40.00 / 7 (full week), truncated
    expect(a.periodBudgetMinor).toBe(22_87); // 4000 − 571·3
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
    expect(a.periodBudgetMinor).toBe(300_00); // full plan (tracking from Aug 1)
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

  it('rolls the reserve into remainingToday, and goes negative once it is gone', () => {
    // Seed on 08-01 → 19 fully-passed days before today, all underspent, so the
    // reserve (запас) is 19 × 10.00 = 190.00 and lifts today's number.
    const seed = tx({ id: 'seed', localDay: '2026-08-01', amountMinor: 0, kind: 'income' });
    const under = computeAllowance({
      plan: plan({ amountMinor: 310_00, currency: 'BYN' }), // perDay 10.00
      recent: [seed, tx({ id: 't1', localDay: '2026-08-20', amountMinor: -3_00 })],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(under.perDayMinor).toBe(10_00);
    expect(under.carryMinor).toBe(190_00);
    expect(under.remainingTodayMinor).toBe(197_00); // 10.00 + 190.00 reserve − 3.00

    // First activity is today → no prior days, so the reserve is 0 and
    // overspending today drives the number negative.
    const over = computeAllowance({
      plan: plan({ amountMinor: 310_00, currency: 'BYN' }),
      recent: [tx({ id: 't1', localDay: '2026-08-20', amountMinor: -14_00 })],
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(over.carryMinor).toBe(0);
    expect(over.remainingTodayMinor).toBe(-4_00); // 10.00 + 0 − 14.00 (overspent)
  });

  it('counts only target spend accounts toward today/period spend', () => {
    const recent = [
      tx({ id: 'seed', localDay: '2026-08-01', amountMinor: 0, kind: 'income', accountId: 'card' }),
      tx({ id: 'c', localDay: '2026-08-20', amountMinor: -3_00, accountId: 'card' }),
      tx({ id: 's', localDay: '2026-08-20', amountMinor: -9_00, accountId: 'savings' }),
    ];
    const base = {
      plan: plan({ amountMinor: 310_00, currency: 'BYN' }),
      recent,
      base: 'BYN',
      rates: {},
      todayLocalDay: '2026-08-20',
      now,
    };
    // All accounts: both expenses count.
    expect(computeAllowance(base).todaySpentMinor).toBe(12_00);
    // Only the card counts: the savings expense is ignored.
    const carded = computeAllowance({ ...base, spendAccountIds: new Set(['card']) });
    expect(carded.todaySpentMinor).toBe(3_00);
    // 10.00 perDay + 190.00 reserve (19 underspent days) − 3.00 spent today.
    expect(carded.remainingTodayMinor).toBe(197_00);
  });
});

describe('resolveSpendAccountIds', () => {
  it('null selects every non-goal account', () => {
    const accounts = [acc({ id: 'card' }), acc({ id: 'cash', kind: 'cash' })];
    expect([...resolveSpendAccountIds(null, accounts)].sort()).toEqual(['card', 'cash']);
  });

  it('a list keeps only the chosen accounts and drops unknown ids', () => {
    const accounts = [acc({ id: 'card' }), acc({ id: 'cash', kind: 'cash' })];
    expect([...resolveSpendAccountIds(['card', 'ghost'], accounts)]).toEqual(['card']);
  });

  it('never includes goal accounts, even under null', () => {
    const accounts = [acc({ id: 'card' }), acc({ id: 'goal1', kind: 'goal' as Account['kind'] })];
    expect([...resolveSpendAccountIds(null, accounts)]).toEqual(['card']);
  });
});
