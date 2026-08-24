import type { Account, Category, Transaction } from '@models';

import { buildWidgetSnapshot, WIDGET_RECENT_LIMIT } from '../snapshot';

const account = (over: Partial<Account> = {}): Account => ({
  id: 'a1',
  name: 'Карта BYN',
  currency: 'BYN',
  kind: 'card',
  icon: null,
  openingMinor: 0,
  sortOrder: 0,
  isDefault: true,
  createdAt: 0,
  updatedAt: 0,
  archivedAt: null,
  ...over,
});

const category = (over: Partial<Category> = {}): Category => ({
  id: 'c1',
  name: 'Еда',
  icon: '🍔',
  color: '#ff0000',
  kind: 'expense',
  isSystem: true,
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
  ...over,
});

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  accountId: 'a1',
  categoryId: null,
  kind: 'expense',
  amountMinor: -12_00,
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

describe('buildWidgetSnapshot', () => {
  const now = new Date(2026, 7, 20);

  it('produces the DATA_MODEL snapshot shape', () => {
    const snap = buildWidgetSnapshot({
      accounts: [account({ id: 'a1', name: 'Карта BYN' })],
      balances: { a1: 340_20 },
      recent: [tx({ id: 't1', categoryId: 'c1', note: 'Обед', amountMinor: -12_00 })],
      categories: [category({ id: 'c1', icon: '🍔' })],
      base: 'BYN',
      rates: {},
      plan: { period: 'month', amountMinor: 310_00, currency: 'BYN' },
      todayLocalDay: '2026-08-20',
      now,
      periodLabel: 'месяц',
      transferLabel: 'Перевод',
      noCategoryLabel: 'Без категории',
      resolveAccountName: (a) => a.name,
      resolveCategoryName: (c) => c.name,
    });

    expect(snap.currency).toBe('BYN');
    expect(snap.daysLeft).toBe(12);
    // Plan 310.00 BYN, but the only activity is Aug 20 → anchor today, so Aug 1..19
    // are forfeited: budget = 310 − 10/day·19 = 120.00; minus the 12.00 spent →
    // 108.00 still spendable this period.
    expect(snap.periodRemainingMinor).toBe(108_00);
    expect(snap.periodLabel).toBe('месяц');
    expect(snap.accounts).toEqual([{ name: 'Карта BYN', balanceMinor: 340_20, currency: 'BYN' }]);
    expect(snap.recent).toEqual([
      { icon: '🍔', note: 'Обед', amountMinor: -12_00, currency: 'BYN' },
    ]);
    expect(snap.updatedAt).toBe(Math.floor(now.getTime() / 1000));
  });

  it(`caps recent to ${WIDGET_RECENT_LIMIT} entries and labels transfers`, () => {
    const snap = buildWidgetSnapshot({
      accounts: [account()],
      balances: { a1: 100_00 },
      recent: [
        tx({ id: 't1', kind: 'transfer', amountMinor: -50_00, note: 'x' }),
        tx({ id: 't2', categoryId: 'c1', note: '' }),
        tx({ id: 't3', amountMinor: 5_00, kind: 'income', note: 'Зарплата' }),
        tx({ id: 't4', note: 'Should be dropped' }),
      ],
      categories: [category({ id: 'c1', name: 'Еда', icon: '🍔' })],
      base: 'BYN',
      rates: {},
      plan: { period: 'month', amountMinor: 310_00, currency: 'BYN' },
      todayLocalDay: '2026-08-20',
      now,
      periodLabel: 'месяц',
      transferLabel: 'Перевод',
      noCategoryLabel: 'Без категории',
      resolveAccountName: (a) => a.name,
      resolveCategoryName: (c) => c.name,
    });

    expect(snap.recent).toHaveLength(WIDGET_RECENT_LIMIT);
    expect(snap.recent[0]).toEqual({
      icon: '🔁',
      note: 'Перевод',
      amountMinor: -50_00,
      currency: 'BYN',
    });
    expect(snap.recent[1]).toEqual({
      icon: '🍔',
      note: 'Еда',
      amountMinor: -12_00,
      currency: 'BYN',
    });
    expect(snap.recent[2]?.note).toBe('Зарплата');
  });
});
