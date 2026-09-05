import type { Account, Category, Transaction } from '@models';
import { type BudgetPlan } from '@utils/budget';
import { computeAllowance } from '@utils/summary';

/**
 * The widget snapshot — the ONLY thing the WidgetKit extension reads
 * (docs/DATA_MODEL.md#снимок-для-виджета). The widget never opens SQLite and
 * never recomputes "можно сегодня" in Swift; it renders these frozen numbers,
 * so the logic can never drift between TS and Swift.
 */

/** How many recent entries the medium widget shows. */
export const WIDGET_RECENT_LIMIT = 6;

export interface WidgetAccountSnapshot {
  name: string;
  balanceMinor: number;
  currency: string;
}

export interface WidgetRecentSnapshot {
  icon: string;
  note: string;
  amountMinor: number;
  currency: string;
}

export interface WidgetSnapshot {
  /** Daily budget (the base allotment, shown beside the remaining number). */
  perDayMinor: number;
  /** Real amount still spendable today = perDay − today's spend (can be < 0). */
  remainingTodayMinor: number;
  /** Base currency code (widget formats with it). */
  currency: string;
  /** Whole days remaining in the period (≥ 1). */
  daysLeft: number;
  /** Base-minor spent today. */
  todaySpentMinor: number;
  /** Base-minor still spendable for the whole period (plan − period spend). */
  periodRemainingMinor: number;
  /** Human period label for the widget, e.g. "месяц" / "неделя". */
  periodLabel: string;
  /** Localized static UI strings (the widget can't run i18n itself). */
  allowanceTitle: string;
  spentLabel: string;
  /** Localized "for the {period}" prefix for the period-remaining line. */
  forPeriodLabel: string;
  emptyLabel: string;
  accounts: WidgetAccountSnapshot[];
  recent: WidgetRecentSnapshot[];
  /** Epoch seconds when this snapshot was built. */
  updatedAt: number;
}

export interface BuildSnapshotInput {
  accounts: Account[];
  balances: Record<string, number>;
  recent: Transaction[];
  categories: Category[];
  base: string;
  /** currency → rate to base ×1e6 (to convert a foreign plan amount). */
  rates: Record<string, number>;
  /** Planned spend for the current period (calendar week/month). */
  plan: BudgetPlan;
  todayLocalDay: string;
  now: Date;
  /** Accounts whose expenses count toward the allowance (целевые счета трат). */
  spendAccountIds?: ReadonlySet<string>;
  /** Localized period word for the widget ("месяц" / "month"). */
  periodLabel: string;
  /** Localized static UI strings (see WidgetSnapshot). */
  allowanceTitle: string;
  spentLabel: string;
  forPeriodLabel: string;
  emptyLabel: string;
  /** Localized "transfer" label for feed rows. */
  transferLabel: string;
  /** Localized "no category" fallback for feed rows. */
  noCategoryLabel: string;
  /** Localized display name for an account (seed names → UI language). */
  resolveAccountName: (account: Account) => string;
  /** Localized display name for a category. */
  resolveCategoryName: (category: Category) => string;
}

/** Icon for a feed row, mirroring the home screen mapping. */
function rowIcon(t: Transaction, category: Category | undefined): string {
  if (t.kind === 'transfer') return '🔁';
  return category?.icon ?? (t.amountMinor >= 0 ? '➕' : '•');
}

/** Human label for a feed row, mirroring the home screen mapping. */
function rowNote(
  t: Transaction,
  category: Category | undefined,
  transferLabel: string,
  noCategoryLabel: string,
  resolveCategoryName: (category: Category) => string,
): string {
  if (t.kind === 'transfer') return transferLabel;
  return t.note || (category ? resolveCategoryName(category) : '') || noCategoryLabel;
}

/** Builds the widget snapshot from the current data store slice. Pure. */
export function buildWidgetSnapshot(input: BuildSnapshotInput): WidgetSnapshot {
  const {
    perDayMinor,
    remainingTodayMinor,
    todaySpentMinor,
    daysLeft,
    periodBudgetMinor,
    periodSpentMinor,
  } = computeAllowance({
    plan: input.plan,
    recent: input.recent,
    base: input.base,
    rates: input.rates,
    todayLocalDay: input.todayLocalDay,
    now: input.now,
    spendAccountIds: input.spendAccountIds,
  });
  const periodRemainingMinor = Math.max(0, periodBudgetMinor - periodSpentMinor);

  const categoryById = new Map(input.categories.map((c) => [c.id, c]));

  const accounts: WidgetAccountSnapshot[] = input.accounts.map((a) => ({
    name: input.resolveAccountName(a),
    balanceMinor: input.balances[a.id] ?? 0,
    currency: a.currency,
  }));

  const recent: WidgetRecentSnapshot[] = input.recent.slice(0, WIDGET_RECENT_LIMIT).map((t) => {
    const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
    return {
      icon: rowIcon(t, category),
      note: rowNote(
        t,
        category,
        input.transferLabel,
        input.noCategoryLabel,
        input.resolveCategoryName,
      ),
      amountMinor: t.amountMinor,
      currency: t.currency,
    };
  });

  return {
    perDayMinor,
    remainingTodayMinor,
    currency: input.base,
    daysLeft,
    todaySpentMinor,
    periodRemainingMinor,
    periodLabel: input.periodLabel,
    allowanceTitle: input.allowanceTitle,
    spentLabel: input.spentLabel,
    forPeriodLabel: input.forPeriodLabel,
    emptyLabel: input.emptyLabel,
    accounts,
    recent,
    updatedAt: Math.floor(input.now.getTime() / 1000),
  };
}
