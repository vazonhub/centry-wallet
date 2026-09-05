import type { AccessibilityRole } from 'react-native';

/**
 * Accessibility helpers (ported from Bsuir Time). `buildLabel` joins non-empty
 * parts into one screen-reader label; `buttonA11y`/`headerA11y` are spread-ready
 * prop bundles; `luminance` decides whether overlaid text should be dark/light.
 */

/** Joins truthy parts into a single comma-separated accessibility label. */
export function buildLabel(...parts: (string | null | undefined | false | 0)[]): string {
  return parts.filter(Boolean).join(', ');
}

/** Spread-ready button a11y props. */
export function buttonA11y(label: string, hint?: string) {
  return {
    accessibilityRole: 'button' as AccessibilityRole,
    accessibilityLabel: label,
    ...(hint ? { accessibilityHint: hint } : undefined),
  };
}

/** Spread-ready header a11y props. */
export function headerA11y(label: string) {
  return {
    accessibilityRole: 'header' as AccessibilityRole,
    accessibilityLabel: label,
  };
}

/**
 * Relative luminance (sRGB) of a hex colour — used to choose readable overlay
 * text/icon colour on a coloured surface (e.g. a goal ring's centre label).
 */
export function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16) / 255;
  const g = parseInt(raw.substring(2, 4), 16) / 255;
  const b = parseInt(raw.substring(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
