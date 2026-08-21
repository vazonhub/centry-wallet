import type { Transaction } from '@models';

import { computeAllowance } from '../summary';
import type { PayoutSchedule, PayoutSlotValue } from '../schedule';

const monthly = (day: number, amounts: Record<string, PayoutSlotValue> = {}): PayoutSchedule => ({
  frequency: 'monthly',
  weekday: 5,
  anchor: null,
  days: [day],
  amounts,
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
  // Fixed clock: 2026-08-20, payday on the 1st → period started 2026-08-01.
  const now = new Date(2026, 7, 20);

  it('daily limit = expected payout ÷ days in period (B21)', () => {
    const a = computeAllowance({
      // 2026-08 period is 01→09-01 = 31 days; payout 310.00 → 10.00/day.
      schedule: monthly(1, { '1': { minor: 310_00, currency: 'BYN' } }),
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
    expect(a.daysLeft).toBe(12); // 2026-08-20 → next payday 2026-09-01
    expect(a.perDayMinor).toBe(10_00); // 310.00 / 31
    expect(a.todaySpentMinor).toBe(3_00); // only the 2026-08-20 expense
    expect(a.configured).toBe(true);
    // carry = perDay(1000) × elapsed(19 days since 08-01) − periodSpent(1000)
    expect(a.carryMinor).toBe(10_00 * 19 - 10_00);
  });

  it('converts a foreign-currency payout to base via its rate', () => {
    const a = computeAllowance({
      // Payout 100.00 USD, 1 USD = 3.00 BYN → 300.00 BYN over 31 days.
      schedule: monthly(1, { '1': { minor: 100_00, currency: 'USD' } }),
      recent: [],
      base: 'BYN',
      rates: { USD: 3_000_000 },
      todayLocalDay: '2026-08-20',
      now,
    });
    expect(a.configured).toBe(true);
    expect(a.perDayMinor).toBe(9_67); // trunc(300.00 / 31)
  });

  it('is unconfigured with a zero limit when no payout is set', () => {
    const a = computeAllowance({
      schedule: monthly(1),
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
      schedule: monthly(1, { '1': { minor: 310_00, currency: 'BYN' } }),
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
