import { buildSeedCategories } from '@constants/categories';
import { DEFAULT_BASE_CURRENCY } from '@constants/currencies';
import { AccountsRepo, CategoriesRepo } from '@db';
import type { Account } from '@models';
import { nowSec } from '@utils/date';
import { uuid } from '@utils/uuid';

/**
 * Seeds system categories and one default account when the tables are empty, so
 * the app is usable immediately with zero setup (rule 3). Idempotent — safe to
 * call on every launch and after a data reset.
 */
export async function seedDefaultsIfEmpty(): Promise<void> {
  const now = nowSec();

  const categories = await CategoriesRepo.listCategories(true);
  if (categories.length === 0) {
    await CategoriesRepo.seedCategories(buildSeedCategories(now));
  }

  const accounts = await AccountsRepo.listAccounts(true);
  if (accounts.length === 0) {
    const account: Account = {
      id: uuid(),
      name: 'Основной',
      currency: DEFAULT_BASE_CURRENCY,
      kind: 'cash',
      icon: 'cash-outline',
      openingMinor: 0,
      sortOrder: 0,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await AccountsRepo.createAccount(account);
  }
}
