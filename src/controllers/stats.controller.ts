import { TransactionsRepo } from '@db';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import { type BalancePoint, buildBalanceSeries, lastNLocalDays } from '@utils/balanceHistory';

/**
 * Balance-over-time series for the wallet-total sheet (docs/UX_SPEC.md#главная).
 * Computed on the fly from the current store balances + per-day deltas (no
 * snapshot table). Read-only: does not mutate the store.
 */
export async function getBalanceSeries(days = 30): Promise<BalancePoint[]> {
  const { accounts, balances, rates } = useDataStore.getState();
  const base = useSettingsStore.getState().baseCurrency;

  const dayList = lastNLocalDays(days, new Date());
  const since = dayList[0] ?? dayList[dayList.length - 1] ?? '';
  const deltas = await TransactionsRepo.dailyDeltasByAccountSince(since);

  return buildBalanceSeries({
    accounts: accounts.map((a) => ({ id: a.id, currency: a.currency })),
    currentBalances: balances,
    deltas,
    rates,
    base,
    days: dayList,
  });
}

export const StatsController = { getBalanceSeries };
