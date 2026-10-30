import { requireOptionalNativeModule } from 'expo-modules-core';

import { TransactionsController } from '@controllers/transactions.controller';
import i18n from '@i18n';
import type { Transaction } from '@models';
import { selectDefaultAccount, useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import { todayLocalDay } from '@utils/date';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { parseAmountToMinor } from '@utils/money';
import { resolveSpendAccountIds } from '@utils/summary';

import { buildWatchPayload } from './payload';

interface WatchNative {
  sendWatchContext(payload: string): void;
  isWatchPaired(): boolean;
  addListener(
    event: 'onWatchAction',
    listener: (e: { payload: string }) => void,
  ): { remove(): void };
}

const native = requireOptionalNativeModule<WatchNative>('CentryNative');

/** Human label for a feed row (note → category → fallback), mirroring the widget. */
function recentNote(t: Transaction): string {
  if (t.kind === 'transfer') return i18n.t('widget.transfer');
  if (t.note) return t.note;
  const cat = t.categoryId
    ? useDataStore.getState().categories.find((c) => c.id === t.categoryId)
    : undefined;
  return cat ? displayCategoryName(cat) : i18n.t('widget.noCategory');
}

/**
 * Builds the watch payload from the current stores and pushes it to the paired
 * Apple Watch. Called after every mutation (hooked into DataController.loadAll)
 * and when the budget changes. Best-effort: never throws, no-ops off-iOS / when
 * the native module or a watch isn't present.
 */
export function sendWatchSnapshot(): void {
  try {
    if (!native) return;
    const data = useDataStore.getState();
    const settings = useSettingsStore.getState();
    const spendAccounts = data.accounts.filter((a) => a.kind !== 'goal');
    const spendAccountIds = resolveSpendAccountIds(settings.spendAccountIds, data.accounts);
    const payload = buildWatchPayload({
      language: settings.language,
      accounts: spendAccounts,
      balances: data.balances,
      recent: data.recent,
      base: settings.baseCurrency,
      rates: data.rates,
      plan: settings.budgetPlan,
      spendAccountIds,
      todayLocalDay: todayLocalDay(),
      now: new Date(),
      allowanceTitle: i18n.t('widget.allowanceTitle'),
      spentLabel: i18n.t('widget.spent'),
      periodLabel:
        settings.budgetPlan.period === 'month'
          ? i18n.t('widget.periodMonth')
          : i18n.t('widget.periodWeek'),
      resolveAccountName: displayAccountName,
      resolveRecentNote: recentNote,
    });
    native.sendWatchContext(JSON.stringify(payload));
  } catch {
    // Best-effort — a failed watch push must never block a save.
  }
}

interface WatchAction {
  type?: 'addExpense' | 'addIncome' | 'setBudget';
  amountMajor?: number;
}

async function handleWatchAction(raw: string): Promise<void> {
  let action: WatchAction;
  try {
    action = JSON.parse(raw) as WatchAction;
  } catch {
    return;
  }
  if (typeof action.amountMajor !== 'number' || action.amountMajor <= 0) return;

  if (action.type === 'addExpense' || action.type === 'addIncome') {
    const account = selectDefaultAccount(useDataStore.getState());
    if (!account) return;
    const amountMinorAbs = parseAmountToMinor(String(action.amountMajor), account.currency);
    if (!amountMinorAbs || amountMinorAbs <= 0) return;
    await TransactionsController.addTransaction({
      accountId: account.id,
      currency: account.currency,
      kind: action.type === 'addIncome' ? 'income' : 'expense',
      amountMinorAbs,
      categoryId: null,
      note: null,
    });
    // addTransaction → loadAll → sendWatchSnapshot, so the watch refreshes.
  } else if (action.type === 'setBudget') {
    const plan = useSettingsStore.getState().budgetPlan;
    const amountMinor = parseAmountToMinor(String(action.amountMajor), plan.currency);
    if (amountMinor === null) return;
    useSettingsStore.getState().setBudgetPlan({ ...plan, amountMinor });
    sendWatchSnapshot(); // setBudgetPlan doesn't run loadAll — push the new plan.
  }
}

let actionSub: { remove(): void } | null = null;

/** Starts listening for actions the watch sends back. Idempotent. */
export function startWatchActionListener(): void {
  if (!native || actionSub) return;
  actionSub = native.addListener('onWatchAction', ({ payload }) => {
    void handleWatchAction(payload);
  });
}
