import { AccountsRepo, CategoriesRepo, TransactionsRepo } from '@db';
import { writeAndShareCsv } from '@services/export';
import { useSettingsStore } from '@stores/settings.store';
import { buildTransactionsCsv } from '@utils/csv';
import { currentTzOffsetMin, todayLocalDay } from '@utils/date';

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
  });

  return writeAndShareCsv(`centry-${todayLocalDay()}.csv`, csv);
}

export const ExportController = { exportTransactionsCsv };
