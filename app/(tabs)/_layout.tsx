import { Platform } from 'react-native';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useIsDark, usePalette } from '@hooks/usePalette';

/**
 * Home is the first and default tab (B24). NativeTabs selects the FIRST Trigger
 * on cold start, so the `(home)` trigger must be declared first below — this
 * `initialRouteName` alone is not enough for the native tab bar.
 */
export const unstable_settings = {
  initialRouteName: '(home)',
};

const iosVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
const supportsLiquidGlass = iosVersion >= 26;

/**
 * Native tab bar (UITabBarController). Three tabs — Главная · История ·
 * Настройки — with Главная first and default (owner, 2026-08-23: Главная is the
 * primary tab). The "+" is NOT here; it is a floating button on the Home screen.
 *
 * iOS 26+: Liquid Glass (`systemChromeMaterial`), never minimizes.
 * iOS 15–18: solid palette background + no transparent scroll-edge appearance.
 */
export default function TabsLayout() {
  const palette = usePalette();
  const isDark = useIsDark();
  const { t } = useTranslation();

  return (
    <NativeTabs
      key={supportsLiquidGlass ? undefined : isDark ? 'dark' : 'light'}
      minimizeBehavior={supportsLiquidGlass ? 'never' : undefined}
      blurEffect={supportsLiquidGlass ? 'systemChromeMaterial' : undefined}
      backgroundColor={supportsLiquidGlass ? undefined : palette.canvasBase}
      disableTransparentOnScrollEdge={!supportsLiquidGlass || undefined}
      // Selected tab uses a neutral grey (the "Без категории" tone) — never a
      // brand/semantic colour, which is reserved for money polarity (rule 6).
      tintColor={palette.dim2}
    >
      <NativeTabs.Trigger name="(home)">
        <Icon sf="house.fill" />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(history)">
        <Icon sf="clock.arrow.circlepath" />
        <Label>{t('tabs.history')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <Icon sf="gearshape.fill" />
        <Label>{t('tabs.settings')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
