import type { Account, Transaction } from '@models';

import { type BudgetPlan } from '../../../utils/budget';
import { buildWatchPayload } from '../payload';

const plan = (over: Partial<BudgetPlan> = {}): BudgetPlan => ({
  period: 'month',
  amountMinor: 0,
  currency: 'BYN',
  ...over,
});

const acc = (over: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: 'Main',
  currency: 'BYN',
  kind: 'card',
  icon: null,
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

const base = {
  language: 'en' as const,
  base: 'BYN',
  rates: {},
  todayLocalDay: '2026-08-20',
  now: new Date(2026, 7, 20),
  allowanceTitle: 'CAN SPEND TODAY',
  spentLabel: 'spent',
  periodLabel: 'month',
  resolveAccountName: (a: Account) => a.name,
  resolveRecentNote: (t: Transaction) => t.note ?? 'row',
};

describe('buildWatchPayload', () => {
  it('carries the allowance, accounts, 30-day series and window totals', () => {
    const payload = buildWatchPayload({
      ...base,
      accounts: [acc({ id: 'a1' }), acc({ id: 'a2', name: 'Cash', kind: 'cash' })],
      balances: { a1: 5_000, a2: 2_000 },
      recent: [
        tx({ id: 's', localDay: '2026-08-01', amountMinor: 0, kind: 'income' }),
        tx({ id: 'e', localDay: '2026-08-20', amountMinor: -3_00 }),
        tx({ id: 'i', localDay: '2026-08-19', amountMinor: 10_00, kind: 'income' }),
      ],
      plan: plan({ amountMinor: 310_00 }), // perDay 10.00
    });

    expect(payload.perDayMinor).toBe(10_00);
    // 10.00 perDay + 190.00 reserve (19 underspent days) − 3.00 spent today.
    expect(payload.remainingTodayMinor).toBe(197_00);
    expect(payload.todaySpentMinor).toBe(3_00);
    expect(payload.accounts).toHaveLength(2);
    expect(payload.accounts[0]).toMatchObject({ name: 'Main', balanceMinor: 5_000 });
    expect(payload.statsByDay).toHaveLength(30);
    expect(payload.statsByDay[29]).toEqual({ day: '2026-08-20', spentMinor: 3_00 });
    expect(payload.windowSpentMinor).toBe(3_00);
    expect(payload.windowIncomeMinor).toBe(10_00);
    expect(payload.statsByTx).toEqual([3_00]);
    expect(payload.budgetAmountMinor).toBe(310_00);
  });

  it('shows a transfer once and never counts it as spend', () => {
    const payload = buildWatchPayload({
      ...base,
      accounts: [acc()],
      balances: { a1: 0 },
      recent: [
        tx({ id: 'from', kind: 'transfer', amountMinor: -50_00, transferPairId: 'p' }),
        tx({ id: 'to', kind: 'transfer', amountMinor: 50_00, transferPairId: 'p' }),
      ],
      plan: plan({ amountMinor: 31_00 }),
    });
    expect(payload.recent).toHaveLength(1); // only the negative leg shown
    expect(payload.windowSpentMinor).toBe(0);
  });
});
