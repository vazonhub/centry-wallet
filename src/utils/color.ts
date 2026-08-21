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
