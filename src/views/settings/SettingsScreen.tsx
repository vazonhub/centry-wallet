import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

import type { ThemeChoice } from '@constants/settings';
import { useIsDark, usePalette } from '@hooks/usePalette';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, ScreenTitle, Spacing, textProps, Typography } from '@theme';
import { hapticLight } from '@utils/haptics';

const THEME_VALUES: ThemeChoice[] = ['system', 'light', 'dark'];
const THEME_LABELS = ['Системная', 'Светлая', 'Тёмная'];

type IconName = keyof typeof Ionicons.glyphMap;
const NAV: { route: string; label: string; icon: IconName }[] = [
  { route: '/(tabs)/(settings)/accounts', label: 'Счета', icon: 'wallet-outline' },
  { route: '/(tabs)/(settings)/money', label: 'Деньги', icon: 'cash-outline' },
  { route: '/(tabs)/(settings)/categories', label: 'Категории', icon: 'pricetags-outline' },
  { route: '/(tabs)/(settings)/input', label: 'Ввод', icon: 'create-outline' },
  { route: '/(tabs)/(settings)/data', label: 'Данные', icon: 'server-outline' },
  { route: '/(tabs)/(settings)/about', label: 'О приложении', icon: 'information-circle-outline' },
];

export function SettingsScreen() {
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const themeIndex = Math.max(0, THEME_VALUES.indexOf(theme));

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text {...textProps('title')} style={styles.screenTitle}>
          Настройки
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ТЕМА</Text>
            <SegmentedControl
              values={THEME_LABELS}
              selectedIndex={themeIndex}
              appearance={isDark ? 'dark' : 'light'}
              onChange={(e) => {
                const value = THEME_VALUES[e.nativeEvent.selectedSegmentIndex];
                if (value) {
                  setTheme(value);
                  hapticLight();
                }
              }}
            />
            <Text style={styles.hint}>Язык — вместе с локализацией в v1.0.</Text>
          </View>

          <View style={styles.navSection}>
            {NAV.map((item) => (
              <Pressable
                key={item.route}
                style={styles.card}
                onPress={() => {
                  hapticLight();
                  router.push(item.route as never);
                }}
              >
                <View style={styles.navRow}>
                  <Ionicons name={item.icon} size={20} color={palette.dim} />
                  <Text style={styles.navLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.dim2} />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    safe: { flex: 1 },
    screenTitle: {
      ...ScreenTitle,
      color: p.ink,
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    scroll: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 140, gap: Spacing.xl },
    section: { gap: Spacing.md },
    // Section headers align to the same left margin as the screen title
    // (they sit inside the scroll's screenPadding — no extra inset).
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize },
    navSection: { gap: Spacing.cardGap },
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      overflow: 'hidden',
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.cardPaddingY,
      paddingHorizontal: Spacing.cardPaddingX,
    },
    navLabel: { flex: 1, color: p.ink, fontSize: 16 },
  });
