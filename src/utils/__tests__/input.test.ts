import type { Account, Transaction } from '@models';
import { daysElapsedInPeriod, daysUntilPayday, periodStartLocalDay } from '@utils/date';
import { parseAmountToMinor } from '@utils/money';
import { periodSpentBaseMinor, todaySpentBaseMinor, totalBalanceBaseMinor } from '@utils/summary';
import { buildTransaction, buildTransferPair } from '@utils/transaction';

describe('parseAmountToMinor', () => {
  it('parses dot and comma decimals', () => {
    expect(parseAmountToMinor('12.5', 'USD')).toBe(1250);
    expect(parseAmountToMinor('12,5', 'USD')).toBe(1250);
    expect(parseAmountToMinor('12', 'USD')).toBe(1200);
    expect(parseAmountToMinor('0,05', 'USD')).toBe(5);
    expect(parseAmountToMinor('.5', 'USD')).toBe(50);
  });

  it('respects currency precision', () => {
    expect(parseAmountToMinor('1500', 'JPY')).toBe(1500); // 0 decimals
    expect(parseAmountToMinor('1,234', 'KWD')).toBe(1234); // 3 decimals
  });

  it('truncates extra decimals and ignores spaces', () => {
    expect(parseAmountToMinor('12.567', 'USD')).toBe(1256);
    expect(parseAmountToMinor('1 000,00', 'USD')).toBe(100000);
  });

  it('rejects empty/invalid input', () => {
    expect(parseAmountToMinor('', 'USD')).toBeNull();
    expect(parseAmountToMinor('.', 'USD')).toBeNull();
    expect(parseAmountToMinor('abc', 'USD')).toBeNull();
    expect(parseAmountToMinor('1.2.3', 'USD')).toBeNull();
  });
});

describe('buildTransaction', () => {
  const draft = {
    accountId: 'a1',
    currency: 'USD',
    kind: 'expense' as const,
    amountMinorAbs: 1250,
    categoryId: 'c1',
    note: 'обед',
    occurredAtSec: Math.floor(Date.UTC(2026, 7, 19, 21, 30, 0) / 1000), // 00:30 Minsk next day
  };

  it('applies the sign convention and freezes the rate + local day', () => {
    const tx = buildTransaction(draft, 3_270_000, 1_787_000_000, 180);
    expect(tx.amountMinor).toBe(-1250);
    expect(tx.kind).toBe('expense');
    expect(tx.rateToBaseE6).toBe(3_270_000);
    expect(tx.localDay).toBe('2026-08-20');
    expect(tx.transferPairId).toBeNull();
    expect(tx.authorId).toBe('me');
    expect(tx.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('income is positive', () => {
    const tx = buildTransaction({ ...draft, kind: 'income' }, 1_000_000, 1_787_000_000, 180);
    expect(tx.amountMinor).toBe(1250);
  });
});

describe('daysUntilPayday', () => {
  it('counts to the next payday within the month', () => {
    expect(daysUntilPayday(25, new Date(2026, 7, 20))).toBe(5);
  });
  it('rolls to next month when payday has passed', () => {
    expect(daysUntilPayday(1, new Date(2026, 7, 20))).toBe(12); // Aug 20 → Sep 1
  });
  it('gives the full next span when today is payday', () => {
    expect(daysUntilPayday(20, new Date(2026, 7, 20))).toBe(31); // Aug 20 → Sep 20
  });
  it('clamps a 31st payday to a short month', () => {
    expect(daysUntilPayday(31, new Date(2026, 1, 10))).toBe(18); // Feb 10 → Feb 28
  });
});

describe('summary math', () => {
  const acc = (id: string, currency: string): Account => ({
    id,
    name: id,
    currency,
    kind: 'cash',
    icon: null,
    openingMinor: 0,
    sortOrder: 0,
    isDefault: false,
    targetMinor: null,
    color: null,
    closedAt: null,
    createdAt: 0,
    updatedAt: 0,
    archivedAt: null,
  });

  it('totals balances into base currency', () => {
    const accounts = [acc('a1', 'BYN'), acc('a2', 'USD')];
    const balances = { a1: 10_000, a2: 5_000 };
    const rates = { USD: 3_270_000 };
    expect(totalBalanceBaseMinor(accounts, balances, rates, 'BYN')).toBe(26_350);
  });

  it('sums today expenses in base using frozen rates', () => {
    const recent: Transaction[] = [
      { localDay: '2026-08-20', amountMinor: -1_250, rateToBaseE6: 3_270_000 } as Transaction,
      { localDay: '2026-08-19', amountMinor: -1_000, rateToBaseE6: 1_000_000 } as Transaction,
      { localDay: '2026-08-20', amountMinor: 5_000, rateToBaseE6: 1_000_000 } as Transaction,
    ];
    expect(todaySpentBaseMinor(recent, '2026-08-20')).toBe(4_088); // 1250 × 3.27, half-up
  });

  it('sums period expenses from the period start, excluding transfers', () => {
    const recent: Transaction[] = [
      {
        localDay: '2026-08-20',
        kind: 'expense',
        amountMinor: -1_000,
        rateToBaseE6: 1_000_000,
      } as Transaction,
      {
        localDay: '2026-08-05',
        kind: 'expense',
        amountMinor: -2_000,
        rateToBaseE6: 1_000_000,
      } as Transaction,
      {
        localDay: '2026-07-31',
        kind: 'expense',
        amountMinor: -9_999,
        rateToBaseE6: 1_000_000,
      } as Transaction, // before period
      {
        localDay: '2026-08-10',
        kind: 'transfer',
        amountMinor: -5_000,
        rateToBaseE6: 1_000_000,
      } as Transaction, // excluded
    ];
    expect(periodSpentBaseMinor(recent, '2026-08-01')).toBe(3_000);
  });
});

describe('period boundaries', () => {
  it('period start is the last payday on or before today', () => {
    expect(periodStartLocalDay(1, new Date(2026, 7, 20))).toBe('2026-08-01');
    expect(periodStartLocalDay(25, new Date(2026, 7, 20))).toBe('2026-07-25');
  });
  it('days elapsed since period start (0 on payday)', () => {
    expect(daysElapsedInPeriod(1, new Date(2026, 7, 20))).toBe(19);
    expect(daysElapsedInPeriod(20, new Date(2026, 7, 20))).toBe(0);
  });
});

describe('buildTransferPair', () => {
  const draft = {
    fromAccountId: 'a1',
    fromCurrency: 'USD',
    fromAmountMinorAbs: 10_000,
    toAccountId: 'a2',
    toCurrency: 'BYN',
    toAmountMinorAbs: 32_700,
    note: null,
    occurredAtSec: Math.floor(Date.UTC(2026, 7, 20, 12, 0, 0) / 1000),
  };

  it('creates two linked legs: source out, destination in', () => {
    const [from, to] = buildTransferPair(draft, 3_270_000, 1_000_000, 1_787_000_000, 180);
    expect(from.amountMinor).toBe(-10_000);
    expect(to.amountMinor).toBe(32_700);
    expect(from.kind).toBe('transfer');
    expect(to.kind).toBe('transfer');
    expect(from.transferPairId).toBe(to.transferPairId);
    expect(from.id).not.toBe(to.id);
    expect(from.currency).toBe('USD');
    expect(to.currency).toBe('BYN');
    expect(from.localDay).toBe('2026-08-20');
  });
});
