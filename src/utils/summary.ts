import type { Account, Transaction } from '@models';

import { type BudgetPlan, effectivePeriod, periodBounds } from './budget';
import { carryOver, convertToBase, perDay } from './money';

const E6_ONE = 1_000_000;

/**
 * Pure summary math for the home screen (docs/UX_SPEC.md#главная). Kept free of
 * DB/store access so it is unit-tested directly. Rates map: currency → rate to
 * base ×1e6 (the base currency itself is treated as 1e6).
 */

/**
 * Sum of account balances converted to the base currency (minor units). When
 * `accountIds` is given, only those accounts are summed — used by the "денег
 * может не хватить" warning, which counts only the accounts the user tracks for
 * daily spending (the "целевые счета трат" setting). Passing nothing sums every
 * account (the wallet total).
 */
export function totalBalanceBaseMinor(
  accounts: Account[],
  balances: Record<string, number>,
  rates: Record<string, number>,
  base: string,
  accountIds?: ReadonlySet<string>,
): number {
  let total = 0;
  for (const a of accounts) {
    if (accountIds && !accountIds.has(a.id)) continue;
    const bal = balances[a.id] ?? 0;
    const rate = a.currency === base ? E6_ONE : (rates[a.currency] ?? E6_ONE);
    total += convertToBase(bal, rate);
  }
  return total;
}

/**
 * Resolves the "целевые счета трат" setting into the concrete set of account ids
 * whose expenses count toward "можно сегодня" and the monthly warning. `null`
 * means "all accounts" (the default, and auto-includes accounts added later).
 * Goal accounts (kind 'goal') are always excluded — money moved onto a goal is a
 * transfer and closing a goal must never register as a daily expense. Ids in the
 * saved list that no longer exist are dropped.
 */
export function resolveSpendAccountIds(
  setting: string[] | null,
  accounts: Account[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const a of accounts) {
    // Goal accounts (added with the goals feature) never count as spend accounts.
    // Checked as a string so this stays valid before 'goal' joins the kind union.
    if ((a.kind as string) === 'goal') continue;
    if (setting === null || setting.includes(a.id)) ids.add(a.id);
  }
  return ids;
}

/**
 * Amount spent today in the base currency (minor units), using each
 * transaction's frozen rate (rule 2). Expenses only (negative amounts). When
 * `spendAccountIds` is given, only expenses on those accounts count (the
 * "целевые счета трат" setting) — spends on non-target accounts are ignored.
 */
export function todaySpentBaseMinor(
  recent: Transaction[],
  todayLocalDay: string,
  spendAccountIds?: ReadonlySet<string>,
): number {
  let spent = 0;
  for (const t of recent) {
    if (t.kind === 'transfer') continue; // internal move, not spending (matches carry-over)
    if (t.localDay !== todayLocalDay) continue;
    if (t.amountMinor >= 0) continue;
    if (spendAccountIds && !spendAccountIds.has(t.accountId)) continue;
    spent += convertToBase(-t.amountMinor, t.rateToBaseE6);
  }
  return spent;
}

/**
 * Expenses in the base currency (minor units) spent since (and including) the
 * period start day — 'YYYY-MM-DD' strings compare lexicographically. Transfers
 * are excluded (they are not spending). Feeds the carry-over plate (B10).
 */
export function periodSpentBaseMinor(
  recent: Transaction[],
  periodStartLocalDay: string,
  spendAccountIds?: ReadonlySet<string>,
): number {
  let spent = 0;
  for (const t of recent) {
    if (t.kind === 'transfer') continue;
    if (t.amountMinor >= 0) continue;
    if (t.localDay < periodStartLocalDay) continue;
    if (spendAccountIds && !spendAccountIds.has(t.accountId)) continue;
    spent += convertToBase(-t.amountMinor, t.rateToBaseE6);
  }
  return spent;
}

/**
 * Earliest recorded activity day within [periodStart, today], or null when the
 * user has no transactions in the period yet. Any kind counts (a transfer or an
 * income is still evidence the user was tracking that day) — it anchors the
 * allowance so untracked earlier days don't inflate the "запас".
 */
export function firstActivityLocalDay(
  recent: Transaction[],
  periodStartLocalDay: string,
  todayLocalDay: string,
): string | null {
  let earliest: string | null = null;
  for (const t of recent) {
    if (t.localDay < periodStartLocalDay) continue;
    if (t.localDay > todayLocalDay) continue;
    if (earliest === null || t.localDay < earliest) earliest = t.localDay;
  }
  return earliest;
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
  /**
   * Accounts whose expenses count toward the allowance (the "целевые счета трат"
   * setting, resolved via `resolveSpendAccountIds`). Omit to count every account.
   */
  spendAccountIds?: ReadonlySet<string>;
}

/** Everything the "можно сегодня" hero (and the widget snapshot) needs. */
export interface Allowance {
  /** Daily budget = planned spend ÷ days in the period. */
  perDayMinor: number;
  /**
   * What is actually still spendable today = `perDayMinor + carryMinor −
   * todaySpentMinor` — today's base allowance plus the accumulated reserve
   * ("запас"), minus what's already been spent today. Goes negative once the
   * reserve is exhausted too (the number the "можно сегодня" hero shows;
   * `perDayMinor` is shown beside it as the base daily rate).
   */
  remainingTodayMinor: number;
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
  /**
   * Base-minor available to spend across the tracked span — the plan minus the
   * share of the days that had already elapsed before tracking began (those days
   * are forfeited, not redistributed). Equals the whole plan when tracking from
   * the period's first day.
   */
  periodBudgetMinor: number;
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
 * the plan is a flat daily rate over the FULL calendar period (perDay = plan ÷
 * calendar days), and the carry-over plate tracks deviation from that pace. The
 * plan is a standalone budget — incomes/expenses never change it, and account
 * balances do NOT feed the daily number (only the separate "денег может не
 * хватить" warning).
 *
 * The daily rate stays the natural calendar rate even on a mid-period first
 * launch; instead of inflating it, the budget for the days that elapsed BEFORE
 * tracking began is forfeited (owner, 2026-08-24). So starting on the 24th of a
 * 31-day month with a 620 plan keeps perDay at 20 and leaves 20 × 8 = 160 for
 * the rest of the month, with no phantom "запас". The daily number and the
 * "запас" are anchored to the first recorded activity day of the period (or
 * today, on a fresh mid-period launch — `firstActivityLocalDay`).
 */
export function computeAllowance(i: AllowanceInput): Allowance {
  const bounds = periodBounds(i.plan.period, i.now);
  const anchor = firstActivityLocalDay(i.recent, bounds.startLocalDay, i.todayLocalDay);
  const eff = effectivePeriod(bounds, anchor, i.todayLocalDay);

  // The plan amount is entered in its own currency; convert to base.
  const expectedBaseMinor =
    i.plan.amountMinor > 0
      ? convertToBase(
          i.plan.amountMinor,
          i.plan.currency === i.base ? E6_ONE : (i.rates[i.plan.currency] ?? E6_ONE),
        )
      : 0;

  // Flat daily rate over the whole calendar period — never inflated by a late start.
  const perDayMinor = perDay(expectedBaseMinor, bounds.daysInPeriod);
  const todaySpentMinor = todaySpentBaseMinor(i.recent, i.todayLocalDay, i.spendAccountIds);
  const periodSpentMinor = periodSpentBaseMinor(i.recent, eff.startLocalDay, i.spendAccountIds);
  // Days elapsed before the anchor forfeit their share of the plan; only the
  // budget from the anchor onward is spendable.
  const daysBeforeAnchor = bounds.daysInPeriod - eff.daysInPeriod;
  const periodBudgetMinor = Math.max(0, expectedBaseMinor - perDayMinor * daysBeforeAnchor);
  // Carry-over ("запас") is the surplus/deficit over days that have FULLY passed;
  // today is excluded — its allowance is still "можно сегодня", not surplus yet —
  // so a first tracking day shows no reserve.
  const carryMinor = carryOver(
    perDayMinor,
    eff.daysElapsed - 1,
    periodSpentMinor - todaySpentMinor,
  );
  return {
    perDayMinor,
    // "Можно сегодня" rolls the reserve in: today's base allowance, plus the
    // accumulated surplus/deficit from days already passed, minus today's spend.
    // So underspending earlier days lets you spend more today (and overspending
    // less) — the reserve is part of the number, not a separate side note.
    remainingTodayMinor: perDayMinor + carryMinor - todaySpentMinor,
    todaySpentMinor,
    carryMinor,
    daysLeft: bounds.daysLeft,
    daysInPeriod: eff.daysInPeriod,
    expectedBaseMinor,
    periodBudgetMinor,
    periodSpentMinor,
    periodStartLocalDay: eff.startLocalDay,
    configured: expectedBaseMinor > 0,
  };
}
