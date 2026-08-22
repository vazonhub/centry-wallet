import type { Account, Transaction } from '@models';

import { type BudgetPlan, periodBounds } from './budget';
import { carryOver, convertToBase, perDay } from './money';

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
  /** Planned spend for the current period (calendar week/month). */
  plan: BudgetPlan;
  recent: Transaction[];
  /** Base currency code (the plan amount is converted into it). */
  base: string;
  /** currency → rate to base ×1e6, to convert a foreign plan amount to base. */
  rates: Record<string, number>;
  /** Today's local day 'YYYY-MM-DD' (device timezone at call time). */
  todayLocalDay: string;
  /** Wall-clock instant; injectable so the math stays unit-testable. */
  now: Date;
}

/** Everything the "можно сегодня" hero (and the widget snapshot) needs. */
export interface Allowance {
  /** Daily budget = planned spend ÷ days in the period. */
  perDayMinor: number;
  /** Base-minor spent today (expenses only). */
  todaySpentMinor: number;
  /** Period surplus (+) / deficit (−) in base minor units (B10). */
  carryMinor: number;
  /** Whole days remaining in the period including today (≥ 1). */
  daysLeft: number;
  /** Whole days in the current period. */
  daysInPeriod: number;
  /** The whole planned spend for the period, in base minor units. */
  expectedBaseMinor: number;
  /** Base-minor already spent this period (expenses only). */
  periodSpentMinor: number;
  /** First day of the current period, 'YYYY-MM-DD' (local). */
  periodStartLocalDay: string;
  /** False until a positive plan amount has been set. */
  configured: boolean;
}

/**
 * The single source of the home "можно сегодня" math, shared by the home screen
 * and the WidgetKit snapshot so the two can never drift (the widget must never
 * recompute this in Swift — docs/DATA_MODEL.md#снимок-для-виджета). Linear model:
 * the planned period spend is spread evenly across the calendar period; the
 * carry-over plate tracks deviation from that pace. The plan is a standalone
 * budget — incomes/expenses never change it, and account balances do NOT feed
 * the daily number (only the separate "денег может не хватить" warning).
 */
export function computeAllowance(i: AllowanceInput): Allowance {
  const bounds = periodBounds(i.plan.period, i.now);

  // The plan amount is entered in its own currency; convert to base.
  const expectedBaseMinor =
    i.plan.amountMinor > 0
      ? convertToBase(
          i.plan.amountMinor,
          i.plan.currency === i.base ? E6_ONE : (i.rates[i.plan.currency] ?? E6_ONE),
        )
      : 0;

  const perDayMinor = perDay(expectedBaseMinor, bounds.daysInPeriod);
  const todaySpentMinor = todaySpentBaseMinor(i.recent, i.todayLocalDay);
  const periodSpentMinor = periodSpentBaseMinor(i.recent, bounds.startLocalDay);
  const carryMinor = carryOver(perDayMinor, bounds.daysElapsed, periodSpentMinor);
  return {
    perDayMinor,
    todaySpentMinor,
    carryMinor,
    daysLeft: bounds.daysLeft,
    daysInPeriod: bounds.daysInPeriod,
    expectedBaseMinor,
    periodSpentMinor,
    periodStartLocalDay: bounds.startLocalDay,
    configured: expectedBaseMinor > 0,
  };
}
