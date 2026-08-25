import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Typography (docs/DESIGN_SYSTEM.md#типографика). Text uses the system font;
 * NUMBERS ALWAYS use a monospace family with tabular figures (rule 7) so the
 * amount column aligns by digit. Money is only ever rendered through the
 * `<Money>` component / `@utils/money` — these tokens back that component.
 */

/** Monospace family for all numbers (SF Mono → Menlo → generic mono). */
export const NUMBER_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});

/** Spread into a `<Text>` that renders numbers to enforce tabular monospace. */
export const numberTextStyle = {
  fontFamily: NUMBER_FONT_FAMILY,
  fontVariant: ['tabular-nums' as const],
};

interface TypographyEntry {
  fontSize: number;
  // RN only supports standard weights; the spec's 560/650/750 map to 500/600/700.
  fontWeight?: TextStyle['fontWeight'];
  letterSpacing?: number;
  maxFontSizeMultiplier: number;
}

export const Typography = {
  /** 44pt hero — the "можно сегодня" number (monospace, tight tracking). */
  hero: { fontSize: 44, fontWeight: '600', letterSpacing: -2.2, maxFontSizeMultiplier: 1.4 },
  /** Screen titles. */
  title: { fontSize: 22, fontWeight: '700', maxFontSizeMultiplier: 2.0 },
  /** Primary content. */
  headline: { fontSize: 17, fontWeight: '600', maxFontSizeMultiplier: 2.0 },
  /** Body text. */
  body: { fontSize: 16, maxFontSizeMultiplier: 2.0 },
  /** List row. */
  row: { fontSize: 13, fontWeight: '500', maxFontSizeMultiplier: 2.0 },
  /** Footnotes, timestamps. */
  footnote: { fontSize: 13, maxFontSizeMultiplier: 2.5 },
  /** Caption. */
  caption: { fontSize: 12, maxFontSizeMultiplier: 2.5 },
  /** Micro heading — uppercase, wide tracking. */
  micro: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, maxFontSizeMultiplier: 1.5 },
} as const satisfies Record<string, TypographyEntry>;

export type TypographyPreset = keyof typeof Typography;

/**
 * Large screen title (the "Настройки"/sub-page heading). Shared by the index
 * screens and `<ScreenHeader>` so every screen title uses the same size and
 * left margin (owner: titles must align consistently everywhere).
 */
export const ScreenTitle = {
  fontSize: 28,
  fontWeight: '700' as const,
  letterSpacing: -0.4,
};

/** Spread-ready props for `<Text>` — enables scaling but caps the multiplier. */
export function textProps(preset: TypographyPreset) {
  return {
    allowFontScaling: true,
    maxFontSizeMultiplier: Typography[preset].maxFontSizeMultiplier,
  };
}
