import {
  accountBalance,
  applyCrossRate,
  carryOver,
  convertFromBase,
  convertToBase,
  crossRateE6,
  formatMoney,
  formatMoneyCompact,
  formatMoneyPlain,
  formatRate,
  getMinorUnits,
  localDay,
  minorToAmountInput,
  parseAmountToMinor,
  parseRateToE6,
  perDay,
  sanitizeRateInput,
  setMoneyLocale,
  sumMixed,
} from '@utils/money';

// Rate helper: human rate → rate_to_base_e6.
const e6 = (rate: number) => Math.round(rate * 1_000_000);

describe('convertToBase — rate application', () => {
  it('converts minor units by several rates', () => {
    // 100.00 USD at 3.27 → 327.00 BYN
    expect(convertToBase(10_000, e6(3.27))).toBe(32_700);
    // 50.00 EUR at 3.56 → 178.00 BYN
    expect(convertToBase(5_000, e6(3.56))).toBe(17_800);
    // Base currency (rate 1.0) is identity.
    expect(convertToBase(1_234, e6(1))).toBe(1_234);
  });

  it('never produces a floating-point result (rule 1)', () => {
    const r = convertToBase(999_999, 1_333_333);
    expect(Number.isInteger(r)).toBe(true);
  });

  it('stays exact for products beyond 2^53', () => {
    // 1_000_000_00 minor (1,000,000.00) × rate 10 → 10,000,000.00 minor.
    // The intermediate product is 1e8 × 1e7 = 1e15 which still fits, so push
    // further: 9_000_000_000 × 9_000_000 = 8.1e16 > Number.MAX_SAFE_INTEGER.
    const amount = 9_000_000_000;
    const rate = e6(9); // 9_000_000
    // Exact expectation via BigInt oracle.
    const expected = Number((BigInt(amount) * BigInt(rate)) / 1_000_000n);
    expect(convertToBase(amount, rate)).toBe(expected);
  });
});

describe('half-up rounding (ties away from zero)', () => {
  it('rounds .5 up in magnitude for positive and negative amounts', () => {
    // 2.5 minor-base equivalents: amount 5 at rate 0.5 → 2.5 → 3
    expect(convertToBase(5, e6(0.5))).toBe(3);
    // negative: −5 at 0.5 → −2.5 → −3
    expect(convertToBase(-5, e6(0.5))).toBe(-3);
    // 2.4 → 2, 2.6 → 3
    expect(convertToBase(24, e6(0.1))).toBe(2);
    expect(convertToBase(26, e6(0.1))).toBe(3);
    // −2.4 → −2, −2.6 → −3
    expect(convertToBase(-24, e6(0.1))).toBe(-2);
    expect(convertToBase(-26, e6(0.1))).toBe(-3);
  });

  it('is exact for odd divisors in convertFromBase', () => {
    // baseMinor 3 with rate 2 (e6=2_000_000): 3 * 1e6 / 2e6 = 1.5 → 2 (away)
    expect(convertFromBase(3, e6(2))).toBe(2);
    // −3 → −1.5 → −2
    expect(convertFromBase(-3, e6(2))).toBe(-2);
  });
});

describe('sumMixed — mixed currencies into base', () => {
  it('converts each item then sums', () => {
    const total = sumMixed([
      { amountMinor: 10_000, rateToBaseE6: e6(3.27) }, // 100 USD → 327.00
      { amountMinor: 5_000, rateToBaseE6: e6(3.56) }, // 50 EUR → 178.00
      { amountMinor: -2_000, rateToBaseE6: e6(1) }, // −20 BYN
    ]);
    expect(total).toBe(32_700 + 17_800 - 2_000);
  });

  it('empty list is zero', () => {
    expect(sumMixed([])).toBe(0);
  });
});

describe('perDay — "можно сегодня"', () => {
  it('divides total by days left, truncating', () => {
    expect(perDay(100_00, 10)).toBe(10_00); // 100.00 / 10 = 10.00
    expect(perDay(100_00, 3)).toBe(3_333); // 33.33 (remainder dropped)
  });

  it('daysLeft = 1 returns the whole total', () => {
    expect(perDay(45_67, 1)).toBe(45_67);
  });

  it('clamps daysLeft below 1 to 1', () => {
    expect(perDay(500, 0)).toBe(500);
    expect(perDay(500, -3)).toBe(500);
  });
});

describe('accountBalance', () => {
  it('opening plus sum of amounts', () => {
    expect(accountBalance(100_00, [-1_200, -3_450, 5_000])).toBe(100_00 - 1_200 - 3_450 + 5_000);
  });

  it('no transactions equals opening', () => {
    expect(accountBalance(7_777, [])).toBe(7_777);
  });
});

describe('carryOver — surplus / deficit', () => {
  const L = 10_00; // 10.00/day limit
  it('positive when under-spent', () => {
    // 3 days elapsed, spent 25.00 of the 30.00 allowed → +5.00
    expect(carryOver(L, 3, 25_00)).toBe(5_00);
  });
  it('negative when over-spent', () => {
    // 3 days elapsed, spent 40.00 → −10.00
    expect(carryOver(L, 3, 40_00)).toBe(-10_00);
  });
  it('zero at the very start of the period', () => {
    expect(carryOver(L, 0, 0)).toBe(0);
  });
});

describe('localDay — day boundary across timezones (rule 8)', () => {
  it('keeps a 00:30 local purchase on its local day, not UTC yesterday', () => {
    // 2026-08-20 00:30 in Minsk (UTC+3) == 2026-08-19 21:30 UTC.
    const utcSec = Math.floor(Date.UTC(2026, 7, 19, 21, 30, 0) / 1000);
    expect(localDay(utcSec, 180)).toBe('2026-08-20');
    // Without the offset it would be the UTC day.
    expect(localDay(utcSec, 0)).toBe('2026-08-19');
  });

  it('handles negative offsets (west of UTC)', () => {
    // 2026-01-01 23:30 in New York (UTC−5) == 2026-01-02 04:30 UTC.
    const utcSec = Math.floor(Date.UTC(2026, 0, 2, 4, 30, 0) / 1000);
    expect(localDay(utcSec, -300)).toBe('2026-01-01');
  });
});

describe('universal multi-currency — triangle A → base → B (B7)', () => {
  it('converts an arbitrary pair through the base currency', () => {
    // 100.00 of arbitrary currency A (rate 3.27) → base, then base → B (rate 3.56).
    const aMinor = 10_000;
    const baseMinor = convertToBase(aMinor, e6(3.27)); // 32_700
    const bMinor = convertFromBase(baseMinor, e6(3.56)); // ≈ 91.85
    const expectedB = Number((BigInt(baseMinor) * 1_000_000n) / BigInt(e6(3.56)));
    // Allow the half-away rounding to differ by at most 1 minor unit from trunc.
    expect(Math.abs(bMinor - expectedB)).toBeLessThanOrEqual(1);
    expect(Number.isInteger(bMinor)).toBe(true);
  });

  it('works for any ISO code, not a fixed BYN/USD/EUR list', () => {
    expect(convertToBase(1_000, e6(0.013))).toBe(13); // e.g. some minor-value currency
  });
});

describe('formatMoney — the only formatter (rule 7)', () => {
  // These assert the RU grouping style (space + comma); pin the locale so the
  // suite is independent of the app default (now EN).
  beforeAll(() => setMoneyLocale('ru'));
  afterAll(() => setMoneyLocale('en'));

  it('groups thousands and shows two decimals with the code', () => {
    expect(formatMoney(1_234_56, 'USD')).toBe('1 234,56 USD');
    expect(formatMoney(-1_234_56, 'USD')).toBe('-1 234,56 USD');
  });

  it('honours zero-decimal currencies', () => {
    expect(getMinorUnits('JPY')).toBe(0);
    expect(formatMoney(1500, 'JPY')).toBe('1 500 JPY');
  });

  it('honours three-decimal currencies', () => {
    expect(getMinorUnits('KWD')).toBe(3);
    expect(formatMoney(1_234, 'KWD')).toBe('1,234 KWD');
  });

  it('supports showPlus, hideCode and signless options', () => {
    expect(formatMoney(500, 'BYN', { showPlus: true })).toBe('+5,00 BYN');
    expect(formatMoney(-500, 'BYN', { hideCode: true })).toBe('-5,00');
    expect(formatMoney(-500, 'BYN', { signless: true, hideCode: true })).toBe('5,00');
    expect(formatMoney(0, 'BYN', { showPlus: true })).toBe('0,00 BYN');
  });
});

describe('minorToAmountInput — editable field pre-fill (inverse of parseAmountToMinor)', () => {
  it('renders an ungrouped major string with the currency precision', () => {
    expect(minorToAmountInput(1_234_56, 'USD')).toBe('1234.56');
    expect(minorToAmountInput(5_00, 'USD')).toBe('5.00');
    expect(minorToAmountInput(7, 'USD')).toBe('0.07');
  });

  it('returns empty for zero so the placeholder shows', () => {
    expect(minorToAmountInput(0, 'USD')).toBe('');
  });

  it('honours zero- and three-decimal currencies', () => {
    expect(minorToAmountInput(1500, 'JPY')).toBe('1500');
    expect(minorToAmountInput(1_234, 'KWD')).toBe('1.234');
  });

  it('round-trips through parseAmountToMinor', () => {
    for (const [minor, cur] of [
      [1_234_56, 'USD'],
      [1500, 'JPY'],
      [1_234, 'KWD'],
    ] as const) {
      expect(parseAmountToMinor(minorToAmountInput(minor, cur), cur)).toBe(minor);
    }
  });
});

describe('formatMoneyCompact — abbreviated large values', () => {
  // RU grouping style (space + comma); pin the locale (app default is now EN).
  beforeAll(() => setMoneyLocale('ru'));
  afterAll(() => setMoneyLocale('en'));

  it('keeps the full grouped form below 10 000 major units', () => {
    expect(formatMoneyCompact(1_000_00, 'BYN')).toBe('1 000,00 BYN');
    expect(formatMoneyCompact(9_999_99, 'BYN')).toBe('9 999,99 BYN');
    expect(formatMoneyCompact(0, 'BYN')).toBe('0,00 BYN');
  });

  it('abbreviates thousands from 10 000 up', () => {
    expect(formatMoneyCompact(10_000_00, 'BYN')).toBe('10k BYN');
    expect(formatMoneyCompact(12_345_00, 'BYN')).toBe('12,3k BYN');
    expect(formatMoneyCompact(999_999_00, 'BYN')).toBe('999,9k BYN');
  });

  it('abbreviates millions, billions and trillions', () => {
    expect(formatMoneyCompact(1_000_000_00, 'BYN')).toBe('1m BYN');
    expect(formatMoneyCompact(1_500_000_00, 'BYN')).toBe('1,5m BYN');
    expect(formatMoneyCompact(2_000_000_000_00, 'BYN')).toBe('2b BYN');
    expect(formatMoneyCompact(3_000_000_000_000_00, 'BYN')).toBe('3t BYN');
  });

  it('honours sign and hideCode options', () => {
    expect(formatMoneyCompact(-25_000_00, 'BYN')).toBe('-25k BYN');
    expect(formatMoneyCompact(25_000_00, 'BYN', { showPlus: true })).toBe('+25k BYN');
    expect(formatMoneyCompact(25_000_00, 'BYN', { hideCode: true })).toBe('25k');
  });

  it('truncates the fraction toward zero (never over-promises)', () => {
    // 19 999.00 → 19,9k (not rounded up to 20k).
    expect(formatMoneyCompact(19_999_00, 'BYN')).toBe('19,9k BYN');
  });
});

describe('formatMoneyPlain — CSV dot-decimal', () => {
  it('renders signed, ungrouped, dot-decimal values', () => {
    expect(formatMoneyPlain(123456, 'USD')).toBe('1234.56');
    expect(formatMoneyPlain(-4088, 'BYN')).toBe('-40.88');
    expect(formatMoneyPlain(0, 'USD')).toBe('0.00');
  });

  it('honours the currency minor-unit precision', () => {
    expect(formatMoneyPlain(-50, 'JPY')).toBe('-50'); // 0 minor digits
    expect(formatMoneyPlain(1234, 'BHD')).toBe('1.234'); // 3 minor digits
  });
});

describe('cross-currency manual rate (transfers)', () => {
  it('crossRateE6 — implied from→to rate from two amounts (same minor units)', () => {
    // 100.00 USD → 92.00 EUR ⇒ 0.92 per USD
    expect(crossRateE6(10000, 'USD', 9200, 'EUR')).toBe(e6(0.92));
    // 100.00 USD → 250.00 EUR ⇒ 2.5 per USD
    expect(crossRateE6(10000, 'USD', 25000, 'EUR')).toBe(e6(2.5));
  });

  it('crossRateE6 — accounts for differing minor-unit precision', () => {
    // 100.00 USD → 15000 JPY (0 minor) ⇒ 150 JPY per USD
    expect(crossRateE6(10000, 'USD', 15000, 'JPY')).toBe(e6(150));
    // 10000 JPY → 66.67 USD ⇒ 0.006667 USD per JPY
    expect(crossRateE6(10000, 'JPY', 6667, 'USD')).toBe(e6(0.006667));
  });

  it('crossRateE6 — null for a non-positive source', () => {
    expect(crossRateE6(0, 'USD', 100, 'EUR')).toBeNull();
    expect(crossRateE6(-100, 'USD', 100, 'EUR')).toBeNull();
  });

  it('applyCrossRate — result in the target currency at the given rate', () => {
    expect(applyCrossRate(10000, 'USD', e6(0.92), 'EUR')).toBe(9200); // 100 × 0.92 = 92.00
    expect(applyCrossRate(10000, 'USD', e6(150), 'JPY')).toBe(15000); // 100 × 150 = 15000 JPY
    expect(applyCrossRate(10000, 'JPY', e6(0.006667), 'USD')).toBe(6667);
  });

  it('applyCrossRate — round-trips with crossRateE6', () => {
    const from = 12345; // 123.45 USD
    const to = 9876; // 98.76 EUR
    const rate = crossRateE6(from, 'USD', to, 'EUR');
    expect(rate).not.toBeNull();
    expect(applyCrossRate(from, 'USD', rate!, 'EUR')).toBe(to);
  });

  it('parseRateToE6 — decimal string to ×1e6', () => {
    expect(parseRateToE6('2.5')).toBe(2_500_000);
    expect(parseRateToE6('2,5')).toBe(2_500_000); // comma separator
    expect(parseRateToE6('0.006667')).toBe(6_667);
    expect(parseRateToE6('150')).toBe(150_000_000);
    expect(parseRateToE6('1.2345678')).toBe(1_234_567); // truncated to 6 decimals
  });

  it('parseRateToE6 — null for empty / invalid / non-positive', () => {
    expect(parseRateToE6('')).toBeNull();
    expect(parseRateToE6('.')).toBeNull();
    expect(parseRateToE6('0')).toBeNull();
    expect(parseRateToE6('abc')).toBeNull();
  });

  it('formatRate — trims trailing zeros with the active locale separator', () => {
    setMoneyLocale('en');
    expect(formatRate(2_500_000)).toBe('2.5');
    expect(formatRate(6_667)).toBe('0.006667');
    expect(formatRate(150_000_000)).toBe('150');
    setMoneyLocale('ru');
    expect(formatRate(2_500_000)).toBe('2,5');
    setMoneyLocale('en'); // restore default
    expect(formatRate(0)).toBe('');
  });

  it('sanitizeRateInput — digits + one separator, ≤6 decimals', () => {
    expect(sanitizeRateInput('2.5')).toBe('2.5');
    expect(sanitizeRateInput('2.50a')).toBe('2.50');
    expect(sanitizeRateInput('0.1234567')).toBe('0.123456'); // capped at 6
    expect(sanitizeRateInput('1.2.3')).toBe('1.23'); // single separator kept
  });
});
