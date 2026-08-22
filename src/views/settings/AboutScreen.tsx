import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

export function AboutScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="О приложении" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Версия</Text>
            <Text style={styles.value}>{version}</Text>
          </View>
        </View>
        <Text style={styles.footnote}>
          Centry — офлайновый трекер. Данные не покидают телефон. Единственный сетевой запрос —
          анонимные курсы валют (наружу уходят только коды валют).
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
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    label: { color: p.ink, fontSize: Typography.body.fontSize },
    value: { color: p.dim, fontSize: Typography.body.fontSize },
    footnote: {
      color: p.dim2,
      fontSize: Typography.footnote.fontSize,
      lineHeight: 20,
    },
  });
