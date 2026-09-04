import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

import type { ThemeChoice } from '@constants/settings';
import { useIsDark, usePalette } from '@hooks/usePalette';
import type { LanguageChoice } from '@i18n';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, ScreenTitle, Spacing, TAB_BAR_HEIGHT, textProps } from '@theme';
import { hapticLight } from '@utils/haptics';

const THEME_VALUES: ThemeChoice[] = ['system', 'light', 'dark'];
const LANGUAGE_VALUES: LanguageChoice[] = ['ru', 'en'];

type IconName = keyof typeof Ionicons.glyphMap;
type NavKey =
  | 'settings.navAccounts'
  | 'settings.navMoney'
  | 'settings.navCategories'
  | 'settings.navInput'
  | 'settings.navAccessibility'
  | 'settings.navData'
  | 'settings.navAbout';
const NAV: { route: string; labelKey: NavKey; icon: IconName }[] = [
  {
    route: '/(tabs)/(settings)/accounts',
    labelKey: 'settings.navAccounts',
    icon: 'wallet-outline',
  },
  { route: '/(tabs)/(settings)/money', labelKey: 'settings.navMoney', icon: 'cash-outline' },
  {
    route: '/(tabs)/(settings)/categories',
    labelKey: 'settings.navCategories',
    icon: 'pricetags-outline',
  },
  { route: '/(tabs)/(settings)/input', labelKey: 'settings.navInput', icon: 'create-outline' },
  {
    route: '/(tabs)/(settings)/accessibility',
    labelKey: 'settings.navAccessibility',
    icon: 'accessibility-outline',
  },
  { route: '/(tabs)/(settings)/data', labelKey: 'settings.navData', icon: 'server-outline' },
  {
    route: '/(tabs)/(settings)/about',
    labelKey: 'settings.navAbout',
    icon: 'information-circle-outline',
  },
];

export function SettingsScreen() {
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const themeIndex = Math.max(0, THEME_VALUES.indexOf(theme));

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const languageIndex = Math.max(0, LANGUAGE_VALUES.indexOf(language));

  const themeLabels = [
    t('settings.themeSystem'),
    t('settings.themeLight'),
    t('settings.themeDark'),
  ];
  const languageLabels = [t('settings.languageRu'), t('settings.languageEn')];

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text {...textProps('title')} style={styles.screenTitle}>
          {t('settings.title')}
        </Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
          ]}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.theme')}</Text>
            <SegmentedControl
              values={themeLabels}
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
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
            <SegmentedControl
              values={languageLabels}
              selectedIndex={languageIndex}
              appearance={isDark ? 'dark' : 'light'}
              onChange={(e) => {
                const value = LANGUAGE_VALUES[e.nativeEvent.selectedSegmentIndex];
                if (value) {
                  setLanguage(value);
                  hapticLight();
                }
              }}
            />
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
                  <Text style={styles.navLabel}>{t(item.labelKey)}</Text>
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
    scroll: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.xl },
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
