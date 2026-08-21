import type { Account, Transaction } from '@models';

import { carryOver, convertToBase, perDay } from './money';
import {
  daysElapsedInPeriod,
  daysInPeriod,
  daysUntilPayday,
  expectedForPeriod,
  periodStartLocalDay,
  type PayoutSchedule,
} from './schedule';

const E6_ONE = 1_000_000;

/**
 * Pure summary math for the home screen (docs/UX_SPEC.md#главная). Kept free of
 * DB/store access so it is unit-tested directly. Rates map: currency → rate to
 * base ×1e6 (the base currency itself is treated as 1e6).
 */

/** Sum of all account balances converted to the base currency (minor units). */
export function totalBalanceBaseMinor(
  accounts: Account[],
  balances: Record<string, number>,
  rates: Record<string, number>,
  base: string,
): number {
  let total = 0;
  for (const a of accounts) {
    const bal = balances[a.id] ?? 0;
    const rate = a.currency === base ? E6_ONE : (rates[a.currency] ?? E6_ONE);
    total += convertToBase(bal, rate);
  }
  return total;
}

/**
 * Amount spent today in the base currency (minor units), using each
 * transaction's frozen rate (rule 2). Expenses only (negative amounts).
 */
export function todaySpentBaseMinor(recent: Transaction[], todayLocalDay: string): number {
  let spent = 0;
  for (const t of recent) {
    if (t.kind === 'transfer') continue; // internal move, not spending (matches carry-over)
    if (t.localDay !== todayLocalDay) continue;
    if (t.amountMinor >= 0) continue;
    spent += convertToBase(-t.amountMinor, t.rateToBaseE6);
  }
  return spent;
}

/**
 * Expenses in the base currency (minor units) spent since (and including) the
 * period start day — 'YYYY-MM-DD' strings compare lexicographically. Transfers
 * are excluded (they are not spending). Feeds the carry-over plate (B10).
 */
export function periodSpentBaseMinor(recent: Transaction[], periodStartLocalDay: string): number {
  let spent = 0;
  for (const t of recent) {
    if (t.kind === 'transfer') continue;
    if (t.amountMinor >= 0) continue;
    if (t.localDay < periodStartLocalDay) continue;
    spent += convertToBase(-t.amountMinor, t.rateToBaseE6);
  }
  return spent;
}

export interface AllowanceInput {
  /** Recurring payout schedule (B21). Drives the period and its expected amount. */
  schedule: PayoutSchedule;
  recent: Transaction[];
  /** Base currency code (the payout slot's amount is converted into it). */
  base: string;
  /** currency → rate to base ×1e6, to convert a foreign payout to base. */
  rates: Record<string, number>;
  /** Today's local day 'YYYY-MM-DD' (device timezone at call time). */
  todayLocalDay: string;
  /** Wall-clock instant; injectable so the math stays unit-testable. */
  now: Date;
}

/** Everything the "можно сегодня" hero (and the widget snapshot) needs. */
export interface Allowance {
  /** Daily budget = expected payout ÷ days in the period. */
  perDayMinor: number;
  /** Base-minor spent today (expenses only). */
  todaySpentMinor: number;
  /** Period surplus (+) / deficit (−) in base minor units (B10). */
  carryMinor: number;
  /** Whole days until the next payday (≥ 1). */
  daysLeft: number;
  /** Whole days in the current period. */
  daysInPeriod: number;
  /** False until an expected payout has been set (onboarding / regular income). */
  configured: boolean;
}

/**
 * The single source of the home "можно сегодня" math, shared by the home screen
 * and the WidgetKit snapshot so the two can never drift (the widget must never
 * recompute this in Swift — docs/DATA_MODEL.md#снимок-для-виджета). Linear model
 * (B21): the expected payout is spread evenly across the period; the carry-over
 * plate tracks deviation from that pace. Account balances do NOT feed the limit.
 */
export function computeAllowance(i: AllowanceInput): Allowance {
  const daysLeft = daysUntilPayday(i.schedule, i.now);
  const totalDays = daysInPeriod(i.schedule, i.now);

  // Expected payout is stored in the slot's own currency; convert to base.
  const expected = expectedForPeriod(i.schedule, i.now);
  const expectedBaseMinor = expected
    ? convertToBase(
        expected.minor,
        expected.currency === i.base ? E6_ONE : (i.rates[expected.currency] ?? E6_ONE),
      )
    : 0;

  const perDayMinor = perDay(expectedBaseMinor, totalDays);
  const todaySpentMinor = todaySpentBaseMinor(i.recent, i.todayLocalDay);
  const periodSpent = periodSpentBaseMinor(i.recent, periodStartLocalDay(i.schedule, i.now));
  const carryMinor = carryOver(perDayMinor, daysElapsedInPeriod(i.schedule, i.now), periodSpent);
  return {
    perDayMinor,
    todaySpentMinor,
    carryMinor,
    daysLeft,
    daysInPeriod: totalDays,
    configured: expectedBaseMinor > 0,
  };
}
