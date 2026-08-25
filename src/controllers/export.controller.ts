import { AccountsRepo, CategoriesRepo, TransactionsRepo } from '@db';
import i18n from '@i18n';
import { writeAndShareCsv } from '@services/export';
import { useSettingsStore } from '@stores/settings.store';
import { buildTransactionsCsv } from '@utils/csv';
import { currentTzOffsetMin, todayLocalDay } from '@utils/date';
import { displayAccountName, displayCategoryName } from '@utils/displayName';

export type ExportCsvStatus = 'shared' | 'unavailable' | 'empty';

/**
 * Builds the full transactions CSV and opens the share sheet. Reads every
 * account/category (including archived/deleted) so historic rows keep their
 * names, and every non-deleted transaction. 'empty' when there is nothing to
 * export — the view surfaces a message instead of an empty file.
 */
async function exportTransactionsCsv(): Promise<ExportCsvStatus> {
  const [transactions, accounts, categories] = await Promise.all([
    TransactionsRepo.listAllTransactions(),
    AccountsRepo.listAccounts(true),
    CategoriesRepo.listCategories(true),
  ]);

  if (transactions.length === 0) return 'empty';

  const csv = buildTransactionsCsv({
    transactions,
    accounts,
    categories,
    baseCurrency: useSettingsStore.getState().baseCurrency,
    tzOffsetMin: currentTzOffsetMin(),
    columns: [
      i18n.t('csv.date'),
      i18n.t('csv.time'),
      i18n.t('csv.type'),
      i18n.t('csv.account'),
      i18n.t('csv.category'),
      i18n.t('csv.amount'),
      i18n.t('csv.currency'),
      i18n.t('csv.amountBase'),
      i18n.t('csv.baseCurrency'),
      i18n.t('csv.rate'),
      i18n.t('csv.note'),
    ],
    kindLabels: {
      expense: i18n.t('csv.kindExpense'),
      income: i18n.t('csv.kindIncome'),
      transfer: i18n.t('csv.kindTransfer'),
    },
    resolveAccountName: displayAccountName,
    resolveCategoryName: displayCategoryName,
  });

  return writeAndShareCsv(`centry-${todayLocalDay()}.csv`, csv);
}

export const ExportController = { exportTransactionsCsv };
