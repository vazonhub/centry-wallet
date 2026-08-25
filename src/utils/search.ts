/**
 * Live search for the history list (docs/UX_SPEC.md#история). Matches a query
 * against a transaction's note, its category name, or its amount — with a
 * bigram (2-gram) similarity pass so small typos and partial words still hit.
 */

/** Character 2-grams of a normalized string. */
function bigrams(s: string): Set<string> {
  const n = s.toLowerCase().replace(/\s+/g, ' ').trim();
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

/** Fraction of the query's bigrams also present in `text` (0..1). */
export function bigramScore(query: string, text: string): number {
  const q = bigrams(query);
  if (q.size === 0) return 0;
  const t = bigrams(text);
  let hit = 0;
  for (const b of q) if (t.has(b)) hit++;
  return hit / q.size;
}

export interface Searchable {
  note: string;
  category: string;
  /** Signed minor units of the transaction's own currency. */
  amountMinor: number;
}

/**
 * True when `query` matches the item. Empty query matches everything. A numeric
 * query is tried against the amount (major units) first; text queries match by
 * substring, then by bigram similarity (note ≥ 0.5, category ≥ 0.6).
 */
export function matchesSearch(query: string, item: Searchable): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  // Numeric query → match against the amount in major units.
  const num = q.replace(',', '.');
  if (/^\d/.test(q) && /^\d+(\.\d+)?$/.test(num)) {
    const abs = Math.abs(item.amountMinor);
    const major = (abs / 100).toString();
    const majorFixed = (abs / 100).toFixed(2);
    if (major.includes(num) || majorFixed.includes(num) || String(abs).includes(q)) return true;
    // fall through: the digits may also appear in the note
  }

  const note = item.note.toLowerCase();
  const category = item.category.toLowerCase();
  if (note.includes(q) || category.includes(q)) return true;

  if (q.length >= 3) {
    if (bigramScore(q, note) >= 0.5 || bigramScore(q, category) >= 0.6) return true;
  }
  return false;
}
