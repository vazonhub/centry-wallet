import { Platform } from 'react-native';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useIsDark, usePalette } from '@hooks/usePalette';

/** Home is the centered, default tab (B19). */
export const unstable_settings = {
  initialRouteName: '(home)',
};

const iosVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;
const supportsLiquidGlass = iosVersion >= 26;

/**
 * Native tab bar (UITabBarController). Three tabs — История · Главная ·
 * Настройки — with Главная centered and default (B19). The "+" is NOT here; it
 * is a floating button on the Home screen.
 *
 * iOS 26+: Liquid Glass (`systemChromeMaterial`), never minimizes.
 * iOS 15–18: solid palette background + no transparent scroll-edge appearance.
 */
export default function TabsLayout() {
  const palette = usePalette();
  const isDark = useIsDark();

  return (
    <NativeTabs
      key={supportsLiquidGlass ? undefined : isDark ? 'dark' : 'light'}
      minimizeBehavior={supportsLiquidGlass ? 'never' : undefined}
      blurEffect={supportsLiquidGlass ? 'systemChromeMaterial' : undefined}
      backgroundColor={supportsLiquidGlass ? undefined : palette.canvasBase}
      disableTransparentOnScrollEdge={!supportsLiquidGlass || undefined}
      // Selected tab uses our brand accent instead of the default iOS blue.
      tintColor={palette.accent}
    >
      <NativeTabs.Trigger name="(history)">
        <Icon sf="clock.arrow.circlepath" />
        <Label>История</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(home)">
        <Icon sf="house.fill" />
        <Label>Главная</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <Icon sf="gearshape.fill" />
        <Label>Настройки</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
