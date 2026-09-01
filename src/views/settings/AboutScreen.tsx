import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

const TELEGRAM_URL = 'https://t.me/multibelbet';
const GITHUB_URL = 'https://github.com/vazonhub/centry-wallet';
const PRIVACY_URL = 'https://kostyabet.github.io/centry/privacy.html';

export function AboutScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <View style={styles.canvas}>
      <ScreenHeader title={t('about.title')} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Links — each its own glass card (matches Accounts / Categories). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.links')}</Text>
          <Pressable style={styles.card} onPress={() => void Linking.openURL(TELEGRAM_URL)}>
            <View style={styles.labelRow}>
              <Ionicons name="paper-plane-outline" size={20} color={palette.accent} />
              <Text style={styles.name}>Telegram</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={palette.dim2} />
          </Pressable>
          <Pressable style={styles.card} onPress={() => void Linking.openURL(GITHUB_URL)}>
            <View style={styles.labelRow}>
              <Ionicons name="logo-github" size={20} color={palette.accent} />
              <Text style={styles.name}>GitHub</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={palette.dim2} />
          </Pressable>
          <Pressable style={styles.card} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            <View style={styles.labelRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={palette.accent} />
              <Text style={styles.name}>{t('about.privacy')}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={palette.dim2} />
          </Pressable>
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about.appInfo')}</Text>
          <View style={styles.card}>
            <Text style={styles.label}>{t('about.version')}</Text>
            <Text style={styles.value}>{version}</Text>
          </View>
        </View>

        <Text style={styles.footnote}>{t('about.footnote')}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    scroll: {
      paddingTop: Spacing.screenPadding,
      paddingHorizontal: Spacing.screenPadding,
      gap: Spacing.xl,
    },
    section: { gap: Spacing.md },
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    card: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, flexShrink: 1 },
    name: { flexShrink: 1, color: p.ink, fontSize: Typography.body.fontSize },
    label: { color: p.ink, fontSize: Typography.body.fontSize },
    value: { color: p.dim, fontSize: Typography.body.fontSize, fontVariant: ['tabular-nums'] },
    footnote: {
      color: p.dim2,
      fontSize: Typography.footnote.fontSize,
      lineHeight: 20,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
  });
