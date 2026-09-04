import { AccountsRepo, CategoriesRepo, TransactionsRepo, wipeAllData } from '@db';
import { ensureRates, getCachedRates } from '@services/rates';
import { sendWatchSnapshot } from '@services/watch';
import { refreshWidgetSnapshot } from '@services/widget';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import { nowSec } from '@utils/date';

import { seedDefaultsIfEmpty } from './seed';

const RATE_SCALE_E6 = 1_000_000;

/**
 * Loads the whole data snapshot from SQLite into the data store. Uses the
 * NETWORK-FREE cached rate table so the UI paints instantly and never blocks on
 * the network (a hung fetch must not stall app launch). Rates are refreshed
 * separately by {@link refreshRates}.
 */
async function loadAll(): Promise<void> {
  const [accounts, categories, recent] = await Promise.all([
    AccountsRepo.listAccounts(),
    CategoriesRepo.listCategories(),
    TransactionsRepo.listRecentTransactions(200),
  ]);

  const balances: Record<string, number> = {};
  await Promise.all(
    accounts.map(async (a) => {
      balances[a.id] = await TransactionsRepo.accountBalanceMinor(a.id);
    }),
  );

  const base = useSettingsStore.getState().baseCurrency;
  const rates = getCachedRates(base);

  useDataStore.getState().setSnapshot({ accounts, categories, recent, balances, rates });

  // Every data mutation funnels through loadAll, so this single hook keeps the
  // App-Group widget snapshot in lock-step with the store after each mutation
  // (and on bootstrap) — docs/DATA_MODEL.md#снимок-для-виджета. Best-effort.
  refreshWidgetSnapshot();
  // Same idea for the Apple Watch, but over WatchConnectivity (a watch is a
  // separate device, so App Groups don't reach it). Best-effort, no-op off-iOS.
  sendWatchSnapshot();
}

/**
 * Background rate refresh (the one network touch, B6). Never throws — on
 * failure the cached/fallback rates stay. Safe to fire-and-forget after load.
 */
async function refreshRates(): Promise<void> {
  const base = useSettingsStore.getState().baseCurrency;
  const rates = await ensureRates(base);
  useDataStore.getState().setSnapshot({ rates });
  refreshWidgetSnapshot(); // the hero total is rate-dependent — keep the widget in sync
}

/**
 * Changes the base currency. Because each transaction's `rate_to_base_e6` is
 * frozen relative to the base it was written under, switching the base would
 * otherwise leave the old base-valued numbers labelled with the new code (e.g.
 * BYN amounts shown as USD). Re-freeze every transaction's rate against the new
 * base using current rates — the recorded money (amount/currency) is untouched,
 * only the derived base rate — so History/allowance/day-nets all agree with the
 * new base. Historical FX accuracy is traded for base-consistency (a deliberate,
 * rare user action).
 */
async function changeBaseCurrency(newBase: string): Promise<void> {
  const prevBase = useSettingsStore.getState().baseCurrency;
  useSettingsStore.getState().setBaseCurrency(newBase);
  if (newBase === prevBase) return;

  await ensureRates(newBase); // best-effort fresh table; never throws (offline → cache)
  const rates = getCachedRates(newBase); // currency → new-base per unit ×1e6
  const currencies = await TransactionsRepo.distinctTransactionCurrencies();
  const now = nowSec();
  for (const currency of currencies) {
    const rateE6 = currency === newBase ? RATE_SCALE_E6 : (rates[currency] ?? RATE_SCALE_E6);
    await TransactionsRepo.rebaseCurrencyRate(currency, rateE6, now);
  }

  await loadAll();
  void refreshRates();
}

/** Wipes all data and re-seeds defaults ("Удалить все данные" in settings). */
async function resetAllData(): Promise<void> {
  await wipeAllData();
  await seedDefaultsIfEmpty();
  await loadAll();
}

/**
 * Force-rebuilds the widget snapshot from the current store and reloads its
 * timelines ("Обновить виджет" in settings). The snapshot is normally refreshed
 * after every mutation; this is the manual escape hatch for when iOS hasn't
 * repainted the widget yet. Best-effort, never throws.
 */
function refreshWidget(): void {
  refreshWidgetSnapshot();
}

export const DataController = {
  loadAll,
  refreshRates,
  resetAllData,
  changeBaseCurrency,
  refreshWidget,
};
