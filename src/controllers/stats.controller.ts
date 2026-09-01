import { TransactionsRepo } from '@db';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import {
  type BalancePoint,
  buildBalanceSeries,
  buildFlowDaySeries,
  buildFlowTxSeries,
  buildTransactionSeries,
  type FlowPoint,
  lastNLocalDays,
  type TxBalancePoint,
} from '@utils/balanceHistory';
import { totalBalanceBaseMinor } from '@utils/summary';

type FlowMode = 'income' | 'expense';

/**
 * Balance-over-time series for the wallet-total sheet (docs/UX_SPEC.md#главная).
 * Computed on the fly from the current store balances + per-day deltas (no
 * snapshot table). Read-only: does not mutate the store.
 *
 * `accountIds`, when given, restricts the series to those accounts so the stats
 * sheet can recompute the chart as the user toggles accounts on/off; omitted =
 * all accounts.
 */
export async function getBalanceSeries(days = 30, accountIds?: string[]): Promise<BalancePoint[]> {
  const { accounts, balances, rates } = useDataStore.getState();
  const base = useSettingsStore.getState().baseCurrency;

  const selected = accountIds ? accounts.filter((a) => accountIds.includes(a.id)) : accounts;

  const dayList = lastNLocalDays(days, new Date());
  const since = dayList[0] ?? dayList[dayList.length - 1] ?? '';
  const deltas = await TransactionsRepo.dailyDeltasByAccountSince(since);

  return buildBalanceSeries({
    accounts: selected.map((a) => ({ id: a.id, currency: a.currency })),
    currentBalances: balances,
    deltas,
    rates,
    base,
    days: dayList,
  });
}

/**
 * Per-transaction balance series for the wallet-total sheet's "по транзакциям"
 * chart mode. Same window as {@link getBalanceSeries}, but one point per
 * transaction rather than per day. Read-only.
 */
export async function getTransactionSeries(
  days = 30,
  accountIds?: string[],
): Promise<TxBalancePoint[]> {
  const { accounts, balances, rates } = useDataStore.getState();
  const base = useSettingsStore.getState().baseCurrency;

  const selected = accountIds ? accounts.filter((a) => accountIds.includes(a.id)) : accounts;
  const ids = selected.map((a) => a.id);

  const dayList = lastNLocalDays(days, new Date());
  const since = dayList[0] ?? dayList[dayList.length - 1] ?? '';
  const txs = await TransactionsRepo.txDeltasSince(since);

  const currentTotalBaseMinor = totalBalanceBaseMinor(selected, balances, rates, base);
  return buildTransactionSeries({ txs, accountIds: ids, currentTotalBaseMinor, rates, base });
}

/**
 * Per-day income OR expense flow for the wallet-total sheet's flow dropdown
 * (docs/UX_SPEC.md#главная). Base minor units, transfers excluded, restricted to
 * the enabled accounts. Read-only.
 */
export async function getFlowDaySeries(
  mode: FlowMode,
  days = 30,
  accountIds?: string[],
): Promise<FlowPoint[]> {
  const { accounts } = useDataStore.getState();
  const selected = accountIds ? accounts.filter((a) => accountIds.includes(a.id)) : accounts;
  const filterIds = accountIds ? selected.map((a) => a.id) : undefined;

  const dayList = lastNLocalDays(days, new Date());
  const since = dayList[0] ?? dayList[dayList.length - 1] ?? '';
  const rows = await TransactionsRepo.flowByDaySince(since, filterIds);
  return buildFlowDaySeries(rows, dayList, mode);
}

/** Per-transaction income OR expense flow — one point per matching transaction. */
export async function getFlowTxSeries(
  mode: FlowMode,
  days = 30,
  accountIds?: string[],
): Promise<FlowPoint[]> {
  const { accounts } = useDataStore.getState();
  const selected = accountIds ? accounts.filter((a) => accountIds.includes(a.id)) : accounts;
  const filterIds = accountIds ? selected.map((a) => a.id) : undefined;

  const dayList = lastNLocalDays(days, new Date());
  const since = dayList[0] ?? dayList[dayList.length - 1] ?? '';
  const txs = await TransactionsRepo.flowTxSince(since, filterIds);
  return buildFlowTxSeries(txs, mode);
}

export const StatsController = {
  getBalanceSeries,
  getTransactionSeries,
  getFlowDaySeries,
  getFlowTxSeries,
};
