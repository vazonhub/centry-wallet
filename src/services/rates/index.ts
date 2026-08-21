import { SETTINGS_KEYS } from '@constants/settings';
import { storage } from '@storage/mmkv';
import { nowSec } from '@utils/date';

/**
 * THE ONLY network module in Centry (rule 5, B6). It anonymously fetches
 * currency rates from the Fawaz currency-api — only currency CODES ever leave
 * the device, never amounts or transactions. Results are cached in MMKV; the
 * app works fully offline off the last cache. Manual overrides win over the
 * auto cache when stamping a new transaction (docs/DATA_MODEL.md#курсы-валют).
 */

const E6_ONE = 1_000_000;
const CACHE_TTL_SEC = 24 * 3600;

type RateMap = Record<string, number>; // currency → rate to base ×1e6

interface RatesCache {
  base: string;
  rates: RateMap;
  syncedAt: number;
}

/** Fawaz endpoints: jsDelivr CDN primary, Cloudflare Pages fallback. */
function endpoints(base: string): string[] {
  const b = base.toLowerCase();
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${b}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${b}.json`,
  ];
}

const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchFromFawaz(base: string): Promise<RateMap> {
  const b = base.toLowerCase();
  for (const url of endpoints(base)) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, Record<string, number>>;
      const table = json[b];
      if (!table) continue;
      const out: RateMap = {};
      for (const [code, perBase] of Object.entries(table)) {
        const v = Number(perBase);
        // Stored value is "units of `code` per 1 base"; we want base per 1 code.
        if (v > 0) out[code.toUpperCase()] = Math.round(E6_ONE / v);
      }
      out[base.toUpperCase()] = E6_ONE;
      return out;
    } catch {
      // try the next endpoint
    }
  }
  throw new Error('rates fetch failed');
}

function readCache(): RatesCache | null {
  const raw = storage.getString(SETTINGS_KEYS.ratesCacheJson);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RatesCache;
  } catch {
    return null;
  }
}

function writeCache(cache: RatesCache): void {
  storage.set(SETTINGS_KEYS.ratesCacheJson, JSON.stringify(cache));
  storage.set(SETTINGS_KEYS.ratesSyncedAt, cache.syncedAt);
}

function readManual(): RateMap {
  const raw = storage.getString(SETTINGS_KEYS.ratesManualJson);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RateMap;
  } catch {
    return {};
  }
}

function withManual(rates: RateMap, base: string): RateMap {
  return { ...rates, ...readManual(), [base.toUpperCase()]: E6_ONE };
}

/**
 * Synchronous, network-free rate lookup for the given base: last cache (if it
 * matches) + manual overrides + base=1. Used to paint the UI instantly on
 * launch; {@link ensureRates} then refreshes in the background.
 */
export function getCachedRates(base: string): RateMap {
  const cache = readCache();
  const rates = cache && cache.base === base ? cache.rates : {};
  return withManual(rates, base);
}

/**
 * Ensures a fresh-enough rate table for `base`, refreshing at most once a day.
 * Never throws: on network failure it silently falls back to the last cache
 * (or just the base=1 identity on a cold offline start).
 */
export async function ensureRates(base: string): Promise<RateMap> {
  const now = nowSec();
  const cache = readCache();
  if (cache && cache.base === base && now - cache.syncedAt < CACHE_TTL_SEC) {
    return withManual(cache.rates, base);
  }
  try {
    const rates = await fetchFromFawaz(base);
    writeCache({ base, rates, syncedAt: now });
    return withManual(rates, base);
  } catch {
    if (cache && cache.base === base) return withManual(cache.rates, base);
    return { [base.toUpperCase()]: E6_ONE };
  }
}

/**
 * Rate to freeze into a new transaction: manual override → cache → on-demand
 * fetch → 1:1 fallback (Build-0 pragmatic; the user can edit the rate later).
 */
export async function getRateForNewTransaction(currency: string, base: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === base.toUpperCase()) return E6_ONE;

  const manual = readManual();
  const manualRate = manual[cur];
  if (manualRate) return manualRate;

  const cache = readCache();
  const cached = cache?.base === base ? cache.rates[cur] : undefined;
  if (cached) return cached;

  try {
    const rates = await fetchFromFawaz(base);
    writeCache({ base, rates, syncedAt: nowSec() });
    const fetched = rates[cur];
    if (fetched) return fetched;
  } catch {
    // fall through to identity
  }
  return E6_ONE;
}
