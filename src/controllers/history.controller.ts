import { TransactionsRepo } from '@db';
import { useHistoryStore } from '@stores/history.store';

/** Loads a month's transactions + totals + top-5 categories into the history store. */
async function loadMonth(month: string): Promise<void> {
  const [transactions, totals, top, earliestMonth] = await Promise.all([
    TransactionsRepo.listTransactionsByMonth(month),
    TransactionsRepo.monthTotalsBaseMinor(month),
    TransactionsRepo.topCategoriesBaseMinor(month, 5),
    TransactionsRepo.earliestMonth(),
  ]);
  useHistoryStore.getState().setSnapshot({
    transactions,
    incomeBaseMinor: totals.income,
    outcomeBaseMinor: totals.outcome,
    topCategories: top.map((t) => ({ categoryId: t.categoryId, totalMinor: t.totalMinor })),
    earliestMonth,
  });
}

export const HistoryController = { loadMonth };
