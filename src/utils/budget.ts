/**
 * Budget planning model (replaces the payout-schedule engine). The user PLANS
 * how much they intend to spend over a calendar period (a week or a month); the
 * plan amount is entered in its own currency and converted to base. "Можно
 * сегодня" = plan ÷ days-in-period, with the carry-over plate tracking deviation
 * from that pace (docs/UX_SPEC.md#главная). Account balances feed only the
 * "денег может не хватить" warning, never the daily number.
 */

export type BudgetPeriod = 'week' | 'month';

export interface BudgetPlan {
  /** Whether the plan amount covers a calendar week or a calendar month. */
  period: BudgetPeriod;
  /** Planned spend for one period, in `currency` minor units (0 = not set). */
  amountMinor: number;
  /** Currency the plan amount is entered in (converted to base for the limit). */
  currency: string;
}

/** A plan is "not configured" until a positive amount is set. */
export function defaultBudgetPlan(baseCurrency: string): BudgetPlan {
  return { period: 'month', amountMinor: 0, currency: baseCurrency };
}

export interface PeriodBounds {
  /** First day of the current period, 'YYYY-MM-DD' (local). */
  startLocalDay: string;
  /** Last day of the current period, 'YYYY-MM-DD' (local). */
  endLocalDay: string;
  /** Whole days in the current period (7, or 28–31). */
  daysInPeriod: number;
  /** Whole days elapsed including today (≥ 1). */
  daysElapsed: number;
  /** Whole days remaining including today (≥ 1). */
  daysLeft: number;
}

/** 'YYYY-MM-DD' for a Date's local calendar day. */
function toLocalDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A 'YYYY-MM-DD' local day back into a Date at local midnight. */
function fromLocalDay(day: string): Date {
  const [y, m, d] = day.split('-').map((n) => parseInt(n, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from `startDay` to `endDay` inclusive (≥ 0; both 'YYYY-MM-DD'). */
export function daysInclusive(startDay: string, endDay: string): number {
  const a = fromLocalDay(startDay).getTime();
  const b = fromLocalDay(endDay).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Calendar-period bounds around `now` (local time). Weeks start on Monday
 * (ru convention); months on the 1st. All day counts are inclusive of today, so
 * `daysElapsed + daysLeft - 1 === daysInPeriod`.
 */
export function periodBounds(period: BudgetPeriod, now: Date): PeriodBounds {
  if (period === 'week') {
    // getDay(): 0=Sun..6=Sat → days since Monday (Mon=0 … Sun=6).
    const sinceMonday = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + 6);
    return {
      startLocalDay: toLocalDay(start),
      endLocalDay: toLocalDay(end),
      daysInPeriod: 7,
      daysElapsed: sinceMonday + 1,
      daysLeft: 7 - sinceMonday,
    };
  }
  // Month.
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), daysInMonth);
  return {
    startLocalDay: toLocalDay(start),
    endLocalDay: toLocalDay(end),
    daysInPeriod: daysInMonth,
    daysElapsed: dayOfMonth,
    daysLeft: daysInMonth - dayOfMonth + 1,
  };
}

export interface EffectivePeriod {
  /** The day the allowance is anchored to (first activity, or today). */
  startLocalDay: string;
  /** Whole days from the effective start to the period end, inclusive (≥ 1). */
  daysInPeriod: number;
  /** Whole days from the effective start through today, inclusive (≥ 1). */
  daysElapsed: number;
}

/**
 * Narrows a calendar period to the span the user has actually been tracking, so
 * a mid-period first launch does not credit a phantom surplus for untracked
 * earlier days (owner, 2026-08-23). The effective start is the first recorded
 * activity day in the period (`firstActivityLocalDay`), or today when there is
 * none — clamped into `[periodStart, today]`. The plan amount is then treated as
 * the budget for THIS remaining span: perDay = plan ÷ `daysInPeriod`.
 */
export function effectivePeriod(
  bounds: PeriodBounds,
  firstActivityLocalDay: string | null,
  todayLocalDay: string,
): EffectivePeriod {
  // Clamp the anchor into the period and never past today.
  let start = firstActivityLocalDay ?? todayLocalDay;
  if (start < bounds.startLocalDay) start = bounds.startLocalDay;
  if (start > todayLocalDay) start = todayLocalDay;
  return {
    startLocalDay: start,
    daysInPeriod: Math.max(1, daysInclusive(start, bounds.endLocalDay)),
    daysElapsed: Math.max(1, daysInclusive(start, todayLocalDay)),
  };
}

/** Human label for a period, e.g. for the "не хватит на неделю" warning. */
export function periodLabel(period: BudgetPeriod): string {
  return period === 'week' ? 'неделю' : 'месяц';
}
