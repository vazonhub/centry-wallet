import { reloadAllTimelines } from 'expo-widgetkit-bridge';

import i18n from '@i18n';
import { writeSiriStats } from '@services/appGroup';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import { WIDGET_SNAPSHOT_KEY, widgetStorage } from '@storage/mmkv';
import { todayLocalDay } from '@utils/date';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { formatMoney } from '@utils/money';
import { totalBalanceBaseMinor } from '@utils/summary';

import { buildWidgetSnapshot } from './snapshot';

export type { WidgetSnapshot } from './snapshot';
export { buildWidgetSnapshot } from './snapshot';

/**
 * Rebuilds the widget snapshot from the current store state, writes it to the
 * App-Group MMKV, and asks WidgetKit to reload. Called by the controllers after
 * every data mutation (docs/DATA_MODEL.md#снимок-для-виджета) — this is the
 * single place snapshot writing lives (the "refresh the snapshot after each
 * mutation" hook the architecture pins to the controller layer).
 *
 * Never throws: a failure to refresh the widget must not break a save. It also
 * no-ops safely off-iOS (reloadAllTimelines is a no-op there, and MMKV just
 * writes to the local container).
 */
export function refreshWidgetSnapshot(): void {
  try {
    const data = useDataStore.getState();
    const settings = useSettingsStore.getState();

    const snapshot = buildWidgetSnapshot({
      accounts: data.accounts,
      balances: data.balances,
      recent: data.recent,
      categories: data.categories,
      base: settings.baseCurrency,
      rates: data.rates,
      plan: settings.budgetPlan,
      todayLocalDay: todayLocalDay(),
      now: new Date(),
      periodLabel:
        settings.budgetPlan.period === 'month'
          ? i18n.t('widget.periodMonth')
          : i18n.t('widget.periodWeek'),
      allowanceTitle: i18n.t('widget.allowanceTitle'),
      spentLabel: i18n.t('widget.spent'),
      forPeriodLabel: i18n.t('widget.forPeriod', {
        period:
          settings.budgetPlan.period === 'month'
            ? i18n.t('widget.periodMonth')
            : i18n.t('widget.periodWeek'),
      }),
      emptyLabel: i18n.t('widget.empty'),
      transferLabel: i18n.t('widget.transfer'),
      noCategoryLabel: i18n.t('widget.noCategory'),
      resolveAccountName: displayAccountName,
      resolveCategoryName: displayCategoryName,
    });

    widgetStorage.set(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
    reloadAllTimelines();

    // Preformatted summary for the Siri info intents (they can't run @utils/money).
    const base = settings.baseCurrency;
    const totalMinor = totalBalanceBaseMinor(data.accounts, data.balances, data.rates, base);
    writeSiriStats({
      total: formatMoney(totalMinor, base),
      canSpend: formatMoney(snapshot.perDayMinor, base),
      spentToday: formatMoney(snapshot.todaySpentMinor, base),
    });
  } catch {
    // Widget refresh is best-effort; swallow so a save is never blocked.
  }
}
