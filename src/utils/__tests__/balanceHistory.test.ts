import {
  buildBalanceSeries,
  buildFlowDaySeries,
  buildFlowTxSeries,
  buildTransactionSeries,
  lastNLocalDays,
} from '../balanceHistory';

describe('lastNLocalDays', () => {
  it('returns ascending local days ending today', () => {
    expect(lastNLocalDays(3, new Date(2026, 7, 20))).toEqual([
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
  });

  it('crosses a month boundary', () => {
    expect(lastNLocalDays(2, new Date(2026, 8, 1))).toEqual(['2026-08-31', '2026-09-01']);
  });
});

describe('buildBalanceSeries', () => {
  const days = ['2026-08-18', '2026-08-19', '2026-08-20'];

  it('walks balances backwards and converts to base at the current rate', () => {
    const series = buildBalanceSeries({
      accounts: [
        { id: 'a1', currency: 'BYN' },
        { id: 'a2', currency: 'USD' },
      ],
      currentBalances: { a1: 100_00, a2: 50_00 }, // end of today (08-20)
      deltas: [
        { accountId: 'a1', localDay: '2026-08-19', deltaMinor: -10_00 },
        { accountId: 'a1', localDay: '2026-08-20', deltaMinor: 20_00 },
        { accountId: 'a2', localDay: '2026-08-20', deltaMinor: 50_00 },
      ],
      rates: { USD: 3_000_000 }, // 1 USD = 3 BYN
      base: 'BYN',
      days,
    });

    expect(series).toEqual([
      { day: '2026-08-18', totalBaseMinor: 90_00 }, // a1 90.00, a2 0
      { day: '2026-08-19', totalBaseMinor: 80_00 }, // a1 80.00, a2 0
      { day: '2026-08-20', totalBaseMinor: 250_00 }, // a1 100.00 + a2 50.00×3
    ]);
  });

  it('last point matches the sum of current balances (converted)', () => {
    const series = buildBalanceSeries({
      accounts: [{ id: 'a1', currency: 'USD' }],
      currentBalances: { a1: 40_00 },
      deltas: [],
      rates: { USD: 2_000_000 },
      base: 'BYN',
      days,
    });
    expect(series[series.length - 1]?.totalBaseMinor).toBe(80_00);
    // Flat when there are no deltas in the window.
    expect(series.every((p) => p.totalBaseMinor === 80_00)).toBe(true);
  });
});

describe('buildTransactionSeries', () => {
  it('walks the running total per transaction; last point = current total', () => {
    // Current total 250.00 BYN. Three windowed transactions (ascending):
    //   +50.00 BYN, -10.00 BYN, +50.00 USD (×3 = +150 BYN).
    const points = buildTransactionSeries({
      txs: [
        { accountId: 'a1', currency: 'BYN', amountMinor: 50_00, localDay: '2026-08-18' },
        { accountId: 'a1', currency: 'BYN', amountMinor: -10_00, localDay: '2026-08-19' },
        { accountId: 'a2', currency: 'USD', amountMinor: 50_00, localDay: '2026-08-20' },
      ],
      accountIds: ['a1', 'a2'],
      currentTotalBaseMinor: 250_00,
      rates: { USD: 3_000_000 },
      base: 'BYN',
    });

    // total before first = 250 − (50 − 10 + 150) = 60.
    expect(points).toEqual([
      { index: 1, day: '2026-08-18', totalBaseMinor: 110_00 }, // 60 + 50
      { index: 2, day: '2026-08-19', totalBaseMinor: 100_00 }, // 110 − 10
      { index: 3, day: '2026-08-20', totalBaseMinor: 250_00 }, // 100 + 150
    ]);
  });

  it('ignores transactions of unselected accounts', () => {
    const points = buildTransactionSeries({
      txs: [
        { accountId: 'a1', currency: 'BYN', amountMinor: 20_00, localDay: '2026-08-20' },
        { accountId: 'a2', currency: 'BYN', amountMinor: 999_00, localDay: '2026-08-20' },
      ],
      accountIds: ['a1'],
      currentTotalBaseMinor: 20_00,
      rates: {},
      base: 'BYN',
    });
    expect(points).toEqual([{ index: 1, day: '2026-08-20', totalBaseMinor: 20_00 }]);
  });

  it('returns an empty series when there are no windowed transactions', () => {
    expect(
      buildTransactionSeries({
        txs: [],
        accountIds: ['a1'],
        currentTotalBaseMinor: 42_00,
        rates: {},
        base: 'BYN',
      }),
    ).toEqual([]);
  });
});

describe('buildFlowDaySeries', () => {
  const days = ['2026-08-18', '2026-08-19', '2026-08-20'];
  const rows = [
    { localDay: '2026-08-18', incomeBaseMinor: 100_00, expenseBaseMinor: 30_00 },
    { localDay: '2026-08-20', incomeBaseMinor: 0, expenseBaseMinor: 12_50 },
  ];

  it('zero-fills income across the plotted days', () => {
    expect(buildFlowDaySeries(rows, days, 'income')).toEqual([
      { day: '2026-08-18', valueBaseMinor: 100_00 },
      { day: '2026-08-19', valueBaseMinor: 0 },
      { day: '2026-08-20', valueBaseMinor: 0 },
    ]);
  });

  it('zero-fills expense across the plotted days', () => {
    expect(buildFlowDaySeries(rows, days, 'expense')).toEqual([
      { day: '2026-08-18', valueBaseMinor: 30_00 },
      { day: '2026-08-19', valueBaseMinor: 0 },
      { day: '2026-08-20', valueBaseMinor: 12_50 },
    ]);
  });
});

describe('buildFlowTxSeries', () => {
  const txs = [
    { localDay: '2026-08-18', amountMinor: 50_00, rateToBaseE6: 1_000_000 }, // income BYN
    { localDay: '2026-08-19', amountMinor: -10_00, rateToBaseE6: 1_000_000 }, // expense BYN
    { localDay: '2026-08-20', amountMinor: -5_00, rateToBaseE6: 3_000_000 }, // expense USD ×3
  ];

  it('keeps only income and reports base magnitudes', () => {
    expect(buildFlowTxSeries(txs, 'income')).toEqual([
      { day: '2026-08-18', valueBaseMinor: 50_00 },
    ]);
  });

  it('keeps only expense, converting at the frozen rate (magnitude)', () => {
    expect(buildFlowTxSeries(txs, 'expense')).toEqual([
      { day: '2026-08-19', valueBaseMinor: 10_00 },
      { day: '2026-08-20', valueBaseMinor: 15_00 }, // 5.00 USD × 3 = 15.00 BYN
    ]);
  });
});
