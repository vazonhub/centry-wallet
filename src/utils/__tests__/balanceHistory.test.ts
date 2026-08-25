import { buildBalanceSeries, lastNLocalDays } from '../balanceHistory';

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
