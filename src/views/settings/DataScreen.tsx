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
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ScreenHeader } from '@components/ScreenHeader';
import { DataController } from '@controllers/data.controller';
import { ExportController } from '@controllers/export.controller';
import { ImportController } from '@controllers/import.controller';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';
import { todayLocalDay } from '@utils/date';
import { hapticSuccess } from '@utils/haptics';
import { formatLocalDay, monthRange, parseLocalDay, weekRange, type DateRange } from '@utils/range';

type ExportPeriod = 'all' | 'month' | 'week' | 'custom';

export function DataScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [widgetRefreshed, setWidgetRefreshed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Export period: 'all' exports everything (the previous behaviour); the rest
  // narrow the export to an inclusive local-day range (rule 8 — by frozen day).
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>('all');
  const [customStart, setCustomStart] = useState<Date>(() =>
    parseLocalDay(monthRange(todayLocalDay()).start),
  );
  const [customEnd, setCustomEnd] = useState<Date>(() => new Date());

  const exportRange = useMemo<DateRange | undefined>(() => {
    const today = todayLocalDay();
    if (exportPeriod === 'month') return monthRange(today);
    if (exportPeriod === 'week') return weekRange(today);
    if (exportPeriod === 'custom') {
      const a = formatLocalDay(customStart);
      const b = formatLocalDay(customEnd);
      return a <= b ? { start: a, end: b } : { start: b, end: a };
    }
    return undefined;
  }, [exportPeriod, customStart, customEnd]);

  const periods = useMemo(
    () =>
      [
        { id: 'all', label: t('data.exportAll') },
        { id: 'month', label: t('data.exportThisMonth') },
        { id: 'week', label: t('data.exportThisWeek') },
        { id: 'custom', label: t('data.exportCustom') },
      ] as { id: ExportPeriod; label: string }[],
    [t],
  );

  const onDeleteAll = () => {
    Alert.alert(t('data.deleteAllTitle'), t('data.deleteAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.deleteAllConfirm'),
        style: 'destructive',
        onPress: () => void DataController.resetAllData(),
      },
    ]);
  };

  const onExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const status = await ExportController.exportTransactionsCsv(exportRange);
      if (status === 'empty') {
        Alert.alert(t('data.exportEmptyTitle'), t('data.exportEmptyBody'), [
          { text: t('common.ok') },
        ]);
      } else if (status === 'unavailable') {
        Alert.alert(t('data.exportUnavailableTitle'), t('data.exportUnavailableBody'), [
          { text: t('common.ok') },
        ]);
      }
    } catch {
      Alert.alert(t('data.exportFailedTitle'), t('data.exportFailedBody'), [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsExporting(false);
    }
  };

  const onImportCsv = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const r = await ImportController.importTransactionsCsv();
      if (r.status === 'cancelled') return;
      if (r.status === 'empty') {
        Alert.alert(t('data.importEmptyTitle'), t('data.importEmptyBody'), [
          { text: t('common.ok') },
        ]);
        return;
      }
      void hapticSuccess();
      Alert.alert(
        t('data.importDoneTitle'),
        t('data.importDoneBody', {
          imported: r.imported,
          skipped: r.skippedTransfers + r.skippedInvalid,
          accounts: r.newAccounts,
        }),
        [{ text: t('common.ok') }],
      );
    } catch {
      Alert.alert(t('data.importFailedTitle'), t('data.importFailedBody'), [
        { text: t('common.ok') },
      ]);
    } finally {
      setIsImporting(false);
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
      <ScreenHeader title={t('data.title')} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>{t('data.exportSection')}</Text>
        <View style={styles.card}>
          <Text style={styles.periodLabel}>{t('data.exportPeriod')}</Text>
          <View style={styles.periodChips}>
            {periods.map((p) => {
              const active = exportPeriod === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setExportPeriod(p.id)}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                >
                  <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {exportPeriod === 'custom' && (
            <View style={styles.customRange}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>{t('data.exportFrom')}</Text>
                <DateTimePicker
                  value={customStart}
                  mode="date"
                  display="compact"
                  maximumDate={customEnd}
                  onChange={(_, d) => d && setCustomStart(d)}
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>{t('data.exportTo')}</Text>
                <DateTimePicker
                  value={customEnd}
                  mode="date"
                  display="compact"
                  minimumDate={customStart}
                  maximumDate={new Date()}
                  onChange={(_, d) => d && setCustomEnd(d)}
                />
              </View>
            </View>
          )}
          <View style={styles.separator} />
          <Pressable onPress={onExportCsv} disabled={isExporting} style={styles.row}>
            <Text style={styles.label}>{t('data.exportCsv')}</Text>
            {isExporting ? (
              <ActivityIndicator color={palette.dim2} />
            ) : (
              <Text style={styles.action}>{t('data.share')}</Text>
            )}
          </Pressable>
          <View style={styles.separator} />
          <Pressable onPress={onImportCsv} disabled={isImporting} style={styles.row}>
            <Text style={styles.label}>{t('data.importCsv')}</Text>
            {isImporting ? (
              <ActivityIndicator color={palette.dim2} />
            ) : (
              <Text style={styles.action}>{t('data.choose')}</Text>
            )}
          </Pressable>
          <Text style={styles.cardHint}>{t('data.importHint')}</Text>
        </View>

        <Text style={styles.section}>{t('data.dataSection')}</Text>
        <View style={styles.card}>
          <Pressable onPress={onRefreshWidget} style={styles.row}>
            <Text style={styles.label}>{t('data.refreshWidget')}</Text>
            <Text style={[styles.action, widgetRefreshed && styles.actionDone]}>
              {widgetRefreshed ? t('data.refreshed') : t('data.refresh')}
            </Text>
          </Pressable>
          <Text style={styles.cardHint}>{t('data.refreshHint')}</Text>
          <View style={styles.separator} />
          <Pressable onPress={onDeleteAll} style={styles.row}>
            <Text style={styles.danger}>{t('data.deleteAll')}</Text>
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
    periodLabel: {
      color: p.dim2,
      fontSize: Typography.caption.fontSize,
      letterSpacing: 0.8,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
    },
    periodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    periodChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    periodChipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    periodChipText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    periodChipTextActive: { color: p.btnInk },
    customRange: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.lg,
      paddingTop: Spacing.md,
    },
    dateField: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    dateLabel: { color: p.dim, fontSize: Typography.footnote.fontSize },
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
