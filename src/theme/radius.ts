/**
 * Border-radius scale + semantic tokens (docs/DESIGN_SYSTEM.md#форма).
 * Hero 24 · cards 16–18 · list rows 16 · icons 11 · tab bar 26 · sheets 30 ·
 * input button 16.
 */
export const Radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,

  // Semantic
  hero: 24,
  card: 16,
  listRow: 16,
  icon: 11,
  tabBar: 26,
  sheet: 30,
  inputButton: 16,
} as const;

export type RadiusToken = keyof typeof Radius;
