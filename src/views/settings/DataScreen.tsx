import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@components/ScreenHeader';
import { DataController } from '@controllers/data.controller';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

export function DataScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  const onDeleteAll = () => {
    Alert.alert('Удалить все данные?', 'Счета, категории и записи будут стёрты. Отменить нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить всё',
        style: 'destructive',
        onPress: () => void DataController.resetAllData(),
      },
    ]);
  };

  // Build 0 keeps CSV export as a stub button only (docs/BUILD0_PLAN.md#что-не-делать).
  const onExportCsv = () => {
    Alert.alert('Экспорт в CSV', 'Появится в версии 1.0.', [{ text: 'Понятно' }]);
  };

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Данные" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Pressable onPress={onExportCsv} style={styles.row}>
            <Text style={styles.label}>Экспорт в CSV</Text>
            <Text style={styles.valueMuted}>v1.0</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Pressable onPress={onDeleteAll} style={styles.row}>
            <Text style={styles.danger}>Удалить все данные</Text>
          </Pressable>
        </View>
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
    valueMuted: { color: p.dim2, fontSize: Typography.footnote.fontSize },
    danger: { color: p.neg, fontSize: Typography.body.fontSize },
  });
