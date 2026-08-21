import { Platform } from 'react-native';

/**
 * Native bottom tab-bar visual height (without safe-area). The floating rounded
 * tab bar (docs/DESIGN_SYSTEM.md) sits 14pt from the edges; scrollable screens
 * add this to `insets.bottom` so the last row is not hidden.
 */
export const TAB_BAR_HEIGHT = Platform.select({ ios: 49, default: 49 });

/** Spacing scale (pt). Use tokens instead of raw numbers in styles. */
export const Spacing = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,

  /** Distance from content to screen edges. */
  screenPadding: 16,
  /** Vertical gap between sibling cards. */
  cardGap: 8,
  /** Floating tab bar inset from screen edges. */
  tabBarInset: 14,
  cardPaddingX: 16,
  cardPaddingY: 14,
} as const;

export type SpacingToken = keyof typeof Spacing;
