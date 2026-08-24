import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@components/ScreenHeader';
import { DataController } from '@controllers/data.controller';
import { ExportController } from '@controllers/export.controller';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

export function DataScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const [isExporting, setIsExporting] = useState(false);

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

  const onExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const status = await ExportController.exportTransactionsCsv();
      if (status === 'empty') {
        Alert.alert('Нечего экспортировать', 'Пока нет ни одной записи.', [{ text: 'Понятно' }]);
      } else if (status === 'unavailable') {
        Alert.alert('Экспорт недоступен', 'Поделиться файлом на этом устройстве нельзя.', [
          { text: 'Понятно' },
        ]);
      }
    } catch {
      Alert.alert('Не удалось экспортировать', 'Попробуйте ещё раз.', [{ text: 'Понятно' }]);
    } finally {
      setIsExporting(false);
    }
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
          <Pressable onPress={onExportCsv} disabled={isExporting} style={styles.row}>
            <Text style={styles.label}>Экспорт в CSV</Text>
            {isExporting ? (
              <ActivityIndicator color={palette.dim2} />
            ) : (
              <Text style={styles.valueMuted}>Поделиться</Text>
            )}
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
