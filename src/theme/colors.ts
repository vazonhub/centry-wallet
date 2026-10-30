/**
 * Liquid Glass palette (docs/DESIGN_SYSTEM.md). Dark theme is a separate pass,
 * NOT an inversion. Colour semantics are fixed (rule 6): `pos` = money in,
 * `neg` = removal / overspend, `warn` = threshold on the hero number only.
 *
 * The screen canvas is a matte plane with three soft colour glows; RN renders
 * them with stacked `expo-linear-gradient`s over `canvasBase` (implemented in a
 * later stage). Blur intensities are `expo-blur` values (0–100), not the CSS
 * pixel radii from the spec.
 */
export interface Palette {
  scheme: 'light' | 'dark';

  /** Flat base fill behind the glow layers. */
  canvasBase: string;
  /** Three glow tints (top-left, top-right, bottom) painted over the base. */
  canvasGlows: readonly [string, string, string];

  ink: string;
  dim: string;
  dim2: string;

  pos: string;
  neg: string;
  warn: string;

  /**
   * Non-semantic UI accent for selection / interactive state (selected tab,
   * active chip). Deliberately NOT green/red — those encode money polarity only
   * (rule 6). A harmonizing indigo drawn from the cool canvas glow.
   */
  accent: string;
  /** Faint accent fill for selected surfaces (accent at low opacity). */
  accentSoft: string;

  // Primary glass surface (hero, account chips, tab bar, sheets).
  glassBg: string;
  glassBorder: string;
  glassShadow: string;
  glassHighlight: string;
  glassBlurIntensity: number;

  // Lighter glass (secondary surfaces).
  glassLightBg: string;
  glassLightBorder: string;

  // Floating tab bar.
  tabBg: string;
  tabBorder: string;

  // Primary action button — polarity flips between themes for max contrast.
  btnBg: string;
  btnInk: string;

  // Sheets / scrim.
  sheetBg: string;
  scrim: string;
}

export const PaletteLight: Palette = {
  scheme: 'light',
  // In-app canvas keeps the original planned matte plane (owner, 2026-08-20).
  // The splash uses the warm cream #faf3e4 (app.json), a deliberate difference.
  canvasBase: '#eef0f5',
  canvasGlows: ['#cfe0ff', '#d8f3e7', '#ffe3d6'],

  ink: '#14161b',
  dim: '#6b7280',
  dim2: '#9aa1ad',

  pos: '#0f7a4f',
  neg: '#b42318',
  warn: '#a35a00',

  accent: '#4b57c4',
  accentSoft: 'rgba(75,87,196,0.12)',

  glassBg: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.72)',
  glassShadow: 'rgba(116,128,150,0.16)',
  glassHighlight: 'rgba(255,255,255,0.9)',
  glassBlurIntensity: 40,

  glassLightBg: 'rgba(255,255,255,0.42)',
  glassLightBorder: 'rgba(255,255,255,0.55)',

  tabBg: 'rgba(255,255,255,0.62)',
  tabBorder: 'rgba(255,255,255,0.8)',

  btnBg: '#14161b',
  btnInk: '#ffffff',

  sheetBg: 'rgba(250,250,252,0.97)',
  scrim: 'rgba(30,35,45,0.32)',
};

export const PaletteDark: Palette = {
  scheme: 'dark',
  // Neutral near-black in-app canvas (the deep navy #000e49 lives only on the splash).
  canvasBase: '#0d0f13',
  canvasGlows: ['#1b3358', '#10352c', '#3a2115'],

  ink: '#eef1f6',
  dim: '#98a0ad',
  dim2: '#6a7280',

  pos: '#4ade80',
  neg: '#ff6b60',
  warn: '#fbbf5a',

  accent: '#9db0ff',
  accentSoft: 'rgba(157,176,255,0.16)',

  glassBg: 'rgba(255,255,255,0.075)',
  glassBorder: 'rgba(255,255,255,0.13)',
  glassShadow: 'rgba(0,0,0,0.5)',
  glassHighlight: 'rgba(255,255,255,0.16)',
  glassBlurIntensity: 50,

  glassLightBg: 'rgba(255,255,255,0.05)',
  glassLightBorder: 'rgba(255,255,255,0.085)',

  tabBg: 'rgba(28,31,38,0.72)',
  tabBorder: 'rgba(255,255,255,0.14)',

  btnBg: '#eef1f6',
  btnInk: '#14161b',

  sheetBg: 'rgba(24,27,33,0.98)',
  scrim: 'rgba(0,0,0,0.55)',
};

/**
 * High-contrast variants, used when iOS "Increase Contrast" is on
 * (useIncreasedContrast). Ink goes to pure black/white, semantic colours darken/
 * brighten for WCAG contrast, and glass surfaces become near-opaque with visible
 * borders so text no longer floats on translucency.
 */
export const PaletteHighContrast: Palette = {
  ...PaletteLight,
  ink: '#000000',
  dim: '#3a3f47',
  dim2: '#565c66',
  pos: '#0a5c3a',
  neg: '#8f1a12',
  warn: '#7a4300',
  accent: '#2f3aa8',
  accentSoft: 'rgba(47,58,168,0.16)',
  glassBg: 'rgba(255,255,255,0.94)',
  glassBorder: 'rgba(0,0,0,0.38)',
  glassLightBg: 'rgba(255,255,255,0.88)',
  glassLightBorder: 'rgba(0,0,0,0.3)',
  tabBg: 'rgba(255,255,255,0.96)',
  tabBorder: 'rgba(0,0,0,0.38)',
  sheetBg: '#ffffff',
};

export const PaletteDarkHighContrast: Palette = {
  ...PaletteDark,
  ink: '#ffffff',
  dim: '#c9ced6',
  dim2: '#a4abb5',
  pos: '#5bef92',
  neg: '#ff8a82',
  warn: '#ffd070',
  accent: '#c2cdff',
  accentSoft: 'rgba(194,205,255,0.22)',
  glassBg: 'rgba(255,255,255,0.16)',
  glassBorder: 'rgba(255,255,255,0.44)',
  glassLightBg: 'rgba(255,255,255,0.12)',
  glassLightBorder: 'rgba(255,255,255,0.34)',
  tabBg: 'rgba(24,27,33,0.96)',
  tabBorder: 'rgba(255,255,255,0.44)',
  sheetBg: 'rgba(16,18,22,1)',
};

export const palettes = {
  light: PaletteLight,
  dark: PaletteDark,
  lightHighContrast: PaletteHighContrast,
  darkHighContrast: PaletteDarkHighContrast,
} as const;
