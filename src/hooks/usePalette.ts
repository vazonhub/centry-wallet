import type { Palette } from '@theme';
import { palettes } from '@theme';
import { useSettingsStore } from '@stores/settings.store';

/**
 * Returns the active Liquid Glass palette based on the resolved scheme kept in
 * the settings store (Bsuir pattern) — NOT `useColorScheme()` — so the JS
 * palette and the native `Appearance` flip atomically without a flash.
 */
export function usePalette(): Palette {
  const resolved = useSettingsStore((s) => s.resolvedScheme);
  return resolved === 'dark' ? palettes.dark : palettes.light;
}

export function useIsDark(): boolean {
  return useSettingsStore((s) => s.resolvedScheme) === 'dark';
}
