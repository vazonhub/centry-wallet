import { useMemo, useRef, useState } from 'react';
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
import { hapticSuccess } from '@utils/haptics';

export function DataScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const [isExporting, setIsExporting] = useState(false);
  const [widgetRefreshed, setWidgetRefreshed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const onRefreshWidget = () => {
    DataController.refreshWidget();
    void hapticSuccess();
    setWidgetRefreshed(true);
    if (refreshedTimer.current) clearTimeout(refreshedTimer.current);
    refreshedTimer.current = setTimeout(() => setWidgetRefreshed(false), 1800);
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
        <Text style={styles.section}>ЭКСПОРТ</Text>
        <View style={styles.card}>
          <Pressable onPress={onExportCsv} disabled={isExporting} style={styles.row}>
            <Text style={styles.label}>Экспорт в CSV</Text>
            {isExporting ? (
              <ActivityIndicator color={palette.dim2} />
            ) : (
              <Text style={styles.action}>Поделиться</Text>
            )}
          </Pressable>
          <Text style={styles.cardHint}>
            Выгружает все записи в CSV-файл (открывается в Excel или Google Таблицах) и показывает
            меню «Поделиться». Импорт добавим позже.
          </Text>
        </View>

        <Text style={styles.section}>ДАННЫЕ</Text>
        <View style={styles.card}>
          <Pressable onPress={onRefreshWidget} style={styles.row}>
            <Text style={styles.label}>Обновить виджет</Text>
            <Text style={[styles.action, widgetRefreshed && styles.actionDone]}>
              {widgetRefreshed ? 'Обновлено ✓' : 'Обновить'}
            </Text>
          </Pressable>
          <Text style={styles.cardHint}>
            Виджет обновляется сам после каждой записи. Нажмите, если iOS ещё не перерисовал его.
          </Text>
          <View style={styles.separator} />
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
      gap: Spacing.sm,
    },
    section: {
      color: p.dim2,
      fontSize: Typography.caption.fontSize,
      letterSpacing: 0.8,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      marginLeft: Spacing.xs,
    },
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: p.glassBorder,
      marginBottom: Spacing.xs,
    },
    label: { color: p.ink, fontSize: Typography.body.fontSize },
    action: { color: p.accent, fontSize: Typography.footnote.fontSize },
    // Not green: green means income only (rule 6). The ✓ carries the success.
    actionDone: { color: p.dim },
    cardHint: { color: p.dim2, fontSize: Typography.footnote.fontSize, paddingTop: Spacing.xs },
    danger: { color: p.neg, fontSize: Typography.body.fontSize },
  });
