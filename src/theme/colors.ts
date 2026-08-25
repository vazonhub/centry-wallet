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

export const palettes = { light: PaletteLight, dark: PaletteDark } as const;
