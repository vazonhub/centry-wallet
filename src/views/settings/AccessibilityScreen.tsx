import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@components/AppIcon';
import { ScreenHeader } from '@components/ScreenHeader';
import { useAccessibility } from '@hooks/useAccessibility';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, textProps, Typography } from '@theme';

interface Feature {
  key: string;
  label: string;
  desc: string;
  enabled: boolean;
  detail?: string;
}

/**
 * Accessibility status screen (ported from Bsuir Time). On iOS every flag is a
 * system setting, so this is read-only: each row shows the live On/Off (or the
 * Dynamic Type scale %), with a button that jumps to the iOS accessibility
 * settings. The app reacts to all of these live (useAccessibility / usePalette /
 * useReduceMotion).
 */
export function AccessibilityScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const a11y = useAccessibility();

  const features: Feature[] = [
    {
      key: 'voiceOver',
      label: t('accessibility.voiceOver'),
      desc: t('accessibility.voiceOverDesc'),
      enabled: a11y.isScreenReaderEnabled,
    },
    {
      key: 'largerText',
      label: t('accessibility.largerText'),
      desc: t('accessibility.largerTextDesc'),
      enabled: a11y.fontScale > 1.0,
      detail: `${Math.round(a11y.fontScale * 100)}%`,
    },
    {
      key: 'boldText',
      label: t('accessibility.boldText'),
      desc: t('accessibility.boldTextDesc'),
      enabled: a11y.isBoldTextEnabled,
    },
    {
      key: 'reduceMotion',
      label: t('accessibility.reduceMotion'),
      desc: t('accessibility.reduceMotionDesc'),
      enabled: a11y.isReduceMotionEnabled,
    },
    {
      key: 'increaseContrast',
      label: t('accessibility.increaseContrast'),
      desc: t('accessibility.increaseContrastDesc'),
      enabled: a11y.isDarkerSystemColorsEnabled,
    },
    {
      key: 'differentiateWithoutColor',
      label: t('accessibility.differentiateWithoutColor'),
      desc: t('accessibility.differentiateWithoutColorDesc'),
      enabled: a11y.isDifferentiateWithoutColorEnabled,
    },
  ];

  return (
    <View style={styles.canvas}>
      <ScreenHeader title={t('accessibility.title')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
      >
        <Text {...textProps('footnote')} style={styles.subtitle}>
          {t('accessibility.subtitle')}
        </Text>

        <View style={styles.card}>
          {features.map((f, i) => {
            const status = f.detail ?? (f.enabled ? t('accessibility.on') : t('accessibility.off'));
            return (
              <View
                key={f.key}
                style={[styles.row, i > 0 && styles.rowTop]}
                accessibilityLabel={`${f.label}, ${status}`}
              >
                <View style={styles.info}>
                  <Text {...textProps('body')} style={styles.label}>
                    {f.label}
                  </Text>
                  <Text {...textProps('footnote')} style={styles.desc}>
                    {f.desc}
                  </Text>
                </View>
                <View style={[styles.badge, f.enabled ? styles.badgeOn : styles.badgeOff]}>
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[styles.badgeText, f.enabled ? styles.badgeTextOn : styles.badgeTextOff]}
                  >
                    {status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          style={styles.settingsBtn}
          onPress={() => void Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.openSettings')}
        >
          <AppIcon name="settings-outline" color={palette.accent} size={18} />
          <Text style={styles.settingsBtnText}>{t('accessibility.openSettings')}</Text>
        </Pressable>

        <Text {...textProps('footnote')} style={styles.footnote}>
          {t('accessibility.footnote')}
        </Text>
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
      gap: Spacing.md,
    },
    subtitle: { color: p.dim, fontSize: Typography.footnote.fontSize, lineHeight: 20 },
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    rowTop: { borderTopColor: p.glassBorder, borderTopWidth: StyleSheet.hairlineWidth },
    info: { flex: 1, gap: 2 },
    label: { color: p.ink, fontSize: Typography.body.fontSize, fontWeight: '600' },
    desc: { color: p.dim, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.sm },
    badgeOn: { backgroundColor: p.accentSoft },
    badgeOff: { backgroundColor: p.glassLightBg },
    badgeText: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
    badgeTextOn: { color: p.accent },
    badgeTextOff: { color: p.dim2 },
    settingsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.lg,
    },
    settingsBtnText: { color: p.accent, fontSize: Typography.body.fontSize, fontWeight: '600' },
    footnote: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
  });
