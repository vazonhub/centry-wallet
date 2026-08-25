import { LEGACY_SEED_CATEGORY_NAMES, SEED_CATEGORY_NAMES } from '@constants/categories';
import type { Account, Category } from '@models';
import i18n from '@i18n';

/**
 * Localized display names for the SEEDED system data (categories + the default
 * account). Their names are stored in the DB in the language they were seeded
 * in; these helpers map the stable seed identity to the current UI language so
 * switching language re-labels them. User-created/renamed rows keep their own
 * stored name. Uses `i18n.t` directly (not the hook) so it also works off-React
 * (widget snapshot, CSV) — React screens re-render on language change via their
 * own `useTranslation`, which recomputes these.
 */

type SeedLeaf =
  | 'food'
  | 'transport'
  | 'cafe'
  | 'home'
  | 'health'
  | 'leisure'
  | 'subs'
  | 'other'
  | 'salary'
  | 'payouts'
  | 'transfers';

/** Stable system-category seed id → translation key (@constants/categories). */
const CATEGORY_KEY: Record<string, `categoriesSeed.${SeedLeaf}`> = {
  'cat-food': 'categoriesSeed.food',
  'cat-transport': 'categoriesSeed.transport',
  'cat-cafe': 'categoriesSeed.cafe',
  'cat-home': 'categoriesSeed.home',
  'cat-health': 'categoriesSeed.health',
  'cat-leisure': 'categoriesSeed.leisure',
  'cat-subs': 'categoriesSeed.subs',
  'cat-other-exp': 'categoriesSeed.other',
  'cat-salary': 'categoriesSeed.salary',
  'cat-payouts': 'categoriesSeed.payouts',
  'cat-transfers-in': 'categoriesSeed.transfers',
};

/** Seed names of the default account across languages (untouched → localizable). */
const SEED_ACCOUNT_NAMES = new Set(['Основной', 'Main']);

/**
 * Display name for a category. Localizes an UNTOUCHED system seed (stored name
 * still equals the current OR the legacy Russian seed name — the latter covers
 * installs seeded before the 2026-08-25 switch to English seeds); once the user
 * renames it, the stored name wins so the rename is visible.
 */
export function displayCategoryName(category: Pick<Category, 'id' | 'name' | 'isSystem'>): string {
  const key = category.isSystem ? CATEGORY_KEY[category.id] : undefined;
  const isUntouchedSeed =
    key != null &&
    (category.name === SEED_CATEGORY_NAMES[category.id] ||
      category.name === LEGACY_SEED_CATEGORY_NAMES[category.id]);
  return isUntouchedSeed ? i18n.t(key) : category.name;
}

/** Display name for an account — localizes the untouched default account seed. */
export function displayAccountName(account: Pick<Account, 'name' | 'isDefault'>): string {
  return account.isDefault && SEED_ACCOUNT_NAMES.has(account.name)
    ? i18n.t('accounts.mainAccount')
    : account.name;
}

/** Localized currency display name, or the code itself if unknown. */
type CurrencyKey =
  | 'currencies.BYN'
  | 'currencies.USD'
  | 'currencies.EUR'
  | 'currencies.RUB'
  | 'currencies.PLN'
  | 'currencies.UAH'
  | 'currencies.GBP'
  | 'currencies.GEL'
  | 'currencies.KZT';

const CURRENCY_KEY: Record<string, CurrencyKey> = {
  BYN: 'currencies.BYN',
  USD: 'currencies.USD',
  EUR: 'currencies.EUR',
  RUB: 'currencies.RUB',
  PLN: 'currencies.PLN',
  UAH: 'currencies.UAH',
  GBP: 'currencies.GBP',
  GEL: 'currencies.GEL',
  KZT: 'currencies.KZT',
};

export function currencyName(code: string): string {
  const key = CURRENCY_KEY[code.toUpperCase()];
  return key ? i18n.t(key) : code;
}
