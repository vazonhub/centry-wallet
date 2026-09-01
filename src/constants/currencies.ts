import { getDeviceRegion } from '@i18n';
import type { CurrencyCode } from '@models';

/**
 * Display metadata for currency pickers. This is NOT a whitelist — Centry
 * supports any ISO-4217 code (B7); `@utils/money#getMinorUnits` is the
 * authority on decimal places. This list only powers the "common" section of
 * the picker. Base currency defaults to BYN for the author (B8).
 */
export const DEFAULT_BASE_CURRENCY: CurrencyCode = 'BYN';

export interface CurrencyMeta {
  code: CurrencyCode;
  /**
   * Fallback English display name. The picker localizes via
   * `@utils/displayName#currencyName` (i18n keys) — this is only a fallback.
   */
  name: string;
  symbol: string;
}

/**
 * The shortlist, in rough global-popularity order. The picker then hoists the
 * user's regional currency to the front via {@link commonCurrencies} so a local
 * user sees their own currency first, everything else by popularity after.
 */
export const COMMON_CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'USD', name: 'US dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'Pound sterling', symbol: '£' },
  { code: 'RUB', name: 'Russian ruble', symbol: '₽' },
  { code: 'PLN', name: 'Polish zloty', symbol: 'zł' },
  { code: 'UAH', name: 'Ukrainian hryvnia', symbol: '₴' },
  { code: 'KZT', name: 'Kazakhstani tenge', symbol: '₸' },
  { code: 'GEL', name: 'Georgian lari', symbol: '₾' },
  { code: 'BYN', name: 'Belarusian ruble', symbol: 'Br' },
] as const;

/** Region (ISO-3166) → its currency, for hoisting the local currency in pickers. */
const REGION_CURRENCY: Record<string, CurrencyCode> = {
  BY: 'BYN',
  RU: 'RUB',
  UA: 'UAH',
  PL: 'PLN',
  GB: 'GBP',
  GE: 'GEL',
  KZ: 'KZT',
  US: 'USD',
  // Euro area (the members likely to use Centry).
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  SK: 'EUR',
  SI: 'EUR',
  LT: 'EUR',
  LV: 'EUR',
  EE: 'EUR',
  LU: 'EUR',
  HR: 'EUR',
  CY: 'EUR',
  MT: 'EUR',
};

/**
 * The common list with `regionCurrency` moved to the front (rest keep their
 * popularity order). Pure — the device lookup lives in {@link commonCurrencies}.
 */
export function orderCommonCurrencies(regionCurrency?: CurrencyCode): CurrencyMeta[] {
  const idx = regionCurrency ? COMMON_CURRENCIES.findIndex((c) => c.code === regionCurrency) : -1;
  if (idx <= 0) return [...COMMON_CURRENCIES];
  const chosen = COMMON_CURRENCIES[idx] as CurrencyMeta;
  return [chosen, ...COMMON_CURRENCIES.filter((c) => c.code !== regionCurrency)];
}

/** Device-aware common currencies: the user's regional currency first. */
export function commonCurrencies(): CurrencyMeta[] {
  return orderCommonCurrencies(REGION_CURRENCY[getDeviceRegion() ?? '']);
}
