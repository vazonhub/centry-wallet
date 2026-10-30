import { TransactionsRepo } from '@db';
import { useHistoryStore } from '@stores/history.store';
import type { DateRange } from '@utils/range';

/** Loads a range's transactions + totals + top-5 categories into the history store. */
async function loadRange(range: DateRange): Promise<void> {
  useHistoryStore.getState().setLoading(true);
  const [transactions, totals, top, earliestDay] = await Promise.all([
    TransactionsRepo.listTransactionsByRange(range.start, range.end),
    TransactionsRepo.rangeTotalsBaseMinor(range.start, range.end),
    TransactionsRepo.topCategoriesByRange(range.start, range.end, 5),
    TransactionsRepo.earliestDay(),
  ]);
  useHistoryStore.getState().setSnapshot({
    transactions,
    incomeBaseMinor: totals.income,
    outcomeBaseMinor: totals.outcome,
    topCategories: top.map((t) => ({ categoryId: t.categoryId, totalMinor: t.totalMinor })),
    earliestDay,
  });
}

export const HistoryController = { loadRange };
