/**
 * Color helpers. Category colours are decorative accents (rule 6 — they never
 * encode +/−); we tint list rows with a faint wash of the category colour.
 */

/** Converts a `#rrggbb` (or `#rgb`) hex to `rgba(r,g,b,alpha)`. */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Parses a `#rrggbb`/`#rgb` hex to `[r, g, b]` (0–255); `null` if malformed. */
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : [r, g, b];
}

/**
 * Blends two hex colours into an OPAQUE `#rrggbb` — `t` is how much of `b` to mix
 * into `a` (0 → all `a`, 1 → all `b`). Used for an opaque tint of a colour over a
 * solid background (e.g. a faint goal-coloured fill that still masks what's behind
 * it, unlike the translucent {@link hexToRgba}).
 */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const ch = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * k);
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(ch(0))}${hx(ch(1))}${hx(ch(2))}`;
}
