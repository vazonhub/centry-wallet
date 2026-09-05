import type { Palette } from '@theme';
import { palettes } from '@theme';
import { useIncreasedContrast } from '@hooks/useAccessibility';
import { useSettingsStore } from '@stores/settings.store';

/**
 * Returns the active Liquid Glass palette based on the resolved scheme kept in
 * the settings store (Bsuir pattern) — NOT `useColorScheme()` — so the JS
 * palette and the native `Appearance` flip atomically without a flash. When iOS
 * "Increase Contrast" is on, swaps to the high-contrast variant.
 */
export function usePalette(): Palette {
  const resolved = useSettingsStore((s) => s.resolvedScheme);
  const highContrast = useIncreasedContrast();
  if (resolved === 'dark') return highContrast ? palettes.darkHighContrast : palettes.dark;
  return highContrast ? palettes.lightHighContrast : palettes.light;
}

export function useIsDark(): boolean {
  return useSettingsStore((s) => s.resolvedScheme) === 'dark';
}
