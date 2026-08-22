/**
 * Money module — the single boundary where money is converted, rounded and
 * formatted (docs/PROJECT_BRIEF.md §7, docs/DATA_MODEL.md).
 *
 * Invariants:
 * - money is INTEGER minor units everywhere; there is NO float in any step;
 * - amount × rate can exceed Number.MAX_SAFE_INTEGER (2^53), so every product
 *   is computed with BigInt and only the final, bounded result is cast to a
 *   Number — using plain `number` multiplication here would silently violate
 *   rule 1 for large amounts;
 * - rounding is HALF_UP in the banking sense: ties round away from zero
 *   (2.5 → 3, −2.5 → −3), so an expense and an equal income round by the same
 *   magnitude. This matches "к ближайшему, half-up" in the brief.
 *
 * This file imports nothing from React Native so it runs in plain Jest.
 */

const RATE_SCALE = 1_000_000n; // rate_to_base_e6 = rate × 1e6

/**
 * Integer division of `n / d` (d > 0) rounding halves away from zero.
 * Exact for any divisor (even or odd): a value is rounded up iff twice the
 * remainder reaches the divisor, so an exact half (2·r == d) rounds up.
 */
function divRoundHalfAwayFromZero(n: bigint, d: bigint): bigint {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const q = abs / d;
  const r = abs % d;
  const rounded = 2n * r >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/** Integer division truncating toward zero (BigInt), d ≠ 0. */
function divTruncate(n: bigint, d: bigint): bigint {
  return n / d;
}

/**
 * Converts `amountMinor` (in some currency) to the base currency's minor units
 * using a frozen rate, rounding half away from zero.
 *
 * base_minor = round(amount_minor × rate_to_base_e6 / 1_000_000)
 */
export function convertToBase(amountMinor: number, rateToBaseE6: number): number {
  const product = BigInt(amountMinor) * BigInt(rateToBaseE6);
  return Number(divRoundHalfAwayFromZero(product, RATE_SCALE));
}

/**
 * Inverse of {@link convertToBase}: base-currency minor units → a currency's
 * minor units, using that currency's frozen rate. Enables any→any conversion
 * through the base currency (A → base → B), rounding half away from zero.
 *
 * currency_minor = round(base_minor × 1_000_000 / rate_to_base_e6)
 */
export function convertFromBase(baseMinor: number, rateToBaseE6: number): number {
  const product = BigInt(baseMinor) * RATE_SCALE;
  return Number(divRoundHalfAwayFromZero(product, BigInt(rateToBaseE6)));
}

/** Sums mixed-currency items into base-currency minor units (each converted, then added). */
export function sumMixed(items: { amountMinor: number; rateToBaseE6: number }[]): number {
  let total = 0n;
  for (const item of items) {
    const product = BigInt(item.amountMinor) * BigInt(item.rateToBaseE6);
    total += divRoundHalfAwayFromZero(product, RATE_SCALE);
  }
  return Number(total);
}

/**
 * Daily allowance: base-minor total split across the days left until payday.
 * `daysLeft` is clamped to ≥ 1 (the last day of a period still allows spending).
 * Truncates toward zero — never promise more than is available.
 */
export function perDay(totalBaseMinor: number, daysLeft: number): number {
  const days = daysLeft < 1 ? 1 : Math.trunc(daysLeft);
  return Number(divTruncate(BigInt(totalBaseMinor), BigInt(days)));
}

/** Account balance in its own currency: opening + sum of same-currency amounts. */
export function accountBalance(openingMinor: number, txAmountsMinor: number[]): number {
  let total = BigInt(openingMinor);
  for (const amount of txAmountsMinor) total += BigInt(amount);
  return Number(total);
}

/**
 * Carry-over for the current period (docs/DATA_MODEL.md#carry-over): the running
 * surplus (+) or deficit (−) so far, in base minor units.
 *
 * delta = limitPerDay × elapsedDays − spentBaseMinor
 *   > 0 → under-spent (today you can spend more);
 *   < 0 → over-spent.
 */
export function carryOver(
  limitPerDayMinor: number,
  elapsedDays: number,
  spentBaseMinor: number,
): number {
  const elapsed = elapsedDays < 0 ? 0 : Math.trunc(elapsedDays);
  return Number(BigInt(limitPerDayMinor) * BigInt(elapsed) - BigInt(spentBaseMinor));
}

/**
 * 'YYYY-MM-DD' for the local calendar day of an instant (rule 8).
 *
 * @param occurredAtSec epoch seconds (UTC)
 * @param tzOffsetMin   minutes EAST of UTC (Minsk UTC+3 → +180). Derive from
 *                      `-new Date().getTimezoneOffset()` at write time.
 *
 * A purchase at 00:30 local stays on its local day instead of slipping into the
 * UTC "yesterday".
 */
export function localDay(occurredAtSec: number, tzOffsetMin: number): string {
  const localMs = (occurredAtSec + tzOffsetMin * 60) * 1000;
  // Read the shifted instant in UTC — the UTC calendar fields now equal the
  // local wall-clock fields.
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(day)}`;
}

// --- Formatting ------------------------------------------------------------

/** Minor-unit exponents that are not the default of 2 (ISO-4217). */
const MINOR_UNITS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  IQD: 3,
  JOD: 3,
  LYD: 3,
};

/** Number of minor digits for a currency (default 2). */
export function getMinorUnits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}

/**
 * Parses a user-typed amount (major units, e.g. "12,50" or "12.5") into integer
 * minor units for the given currency. Accepts comma or dot as the decimal
 * separator and ignores spaces. Extra decimals beyond the currency's precision
 * are truncated. Returns null for empty/invalid input. Always non-negative —
 * the sign comes from the transaction kind, not the text field.
 */
export function parseAmountToMinor(input: string, currency: string): number | null {
  const units = getMinorUnits(currency);
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;

  const [intRaw, fracRaw = ''] = cleaned.split('.');
  const intPart = intRaw === '' ? '0' : intRaw;
  const frac = (fracRaw + '0'.repeat(units)).slice(0, units);
  const minor = Number(intPart + frac);
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Sanitizes live amount-field text: keeps digits and a single decimal separator
 * (the user's first `.` or `,`), drops everything else (+, -, =, letters), and
 * truncates the fraction to the currency's precision. Feeds a controlled
 * TextInput so only valid numeric money can be typed.
 */
export function sanitizeAmountInput(input: string, currency: string): string {
  const units = getMinorUnits(currency);
  const s = input.replace(/[^\d.,]/g, '');
  const sepIndex = s.search(/[.,]/);
  if (sepIndex === -1) return s;
  const sep = s[sepIndex] ?? '.';
  const intPart = s.slice(0, sepIndex).replace(/[.,]/g, '');
  if (units === 0) return intPart;
  const frac = s
    .slice(sepIndex + 1)
    .replace(/[.,]/g, '')
    .slice(0, units);
  return intPart + sep + frac;
}

/**
 * Renders minor units as a plain, ungrouped editable string for an amount field
 * (e.g. 123456 in USD → "1234.56"). The inverse of {@link parseAmountToMinor},
 * used to pre-fill an editable field (e.g. an account's starting balance).
 * Returns '' for zero so the field shows its placeholder.
 */
export function minorToAmountInput(minor: number, currency: string): string {
  if (minor === 0) return '';
  const units = getMinorUnits(currency);
  const negative = minor < 0;
  const digits = String(Math.abs(minor));
  let out: string;
  if (units === 0) {
    out = digits;
  } else {
    const padded = digits.padStart(units + 1, '0');
    out = padded.slice(0, -units) + '.' + padded.slice(-units);
  }
  return negative ? '-' + out : out;
}

/** Placeholder for an amount field, e.g. "0,00" (integer + fraction shape). */
export function amountPlaceholder(currency: string): string {
  const units = getMinorUnits(currency);
  return units > 0 ? `0,${'0'.repeat(units)}` : '0';
}

export interface FormatMoneyOptions {
  /** Prefix positive values with '+' (never applied to zero). */
  showPlus?: boolean;
  /** Omit the trailing currency code. */
  hideCode?: boolean;
  /** Format the magnitude only, without any sign. */
  signless?: boolean;
}

/**
 * The ONLY money formatter (rule 7). Produces a ru-style grouped string, e.g.
 * `-1 234,56 USD`. Numbers are rendered with a monospace / tabular font by the
 * `<Money>` component, not here.
 */
export function formatMoney(
  minor: number,
  currency: string,
  opts: FormatMoneyOptions = {},
): string {
  const units = getMinorUnits(currency);
  const divisor = 10n ** BigInt(units);

  const negative = minor < 0;
  const absMinor = BigInt(negative ? -minor : minor);
  const intPart = absMinor / divisor;
  const fracPart = absMinor % divisor;

  const grouped = groupThousands(intPart.toString());
  const fraction = units > 0 ? ',' + fracPart.toString().padStart(units, '0') : '';

  let sign = '';
  if (!opts.signless) {
    if (negative) sign = '-';
    else if (opts.showPlus && minor > 0) sign = '+';
  }

  const code = opts.hideCode ? '' : ' ' + currency.toUpperCase();
  return `${sign}${grouped}${fraction}${code}`;
}

/** Inserts a thin space every three digits from the right. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
