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
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [widgetRefreshed, setWidgetRefreshed] = useState(false);
  const refreshedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const status = await ExportController.exportTransactionsCsv();
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
          <Pressable onPress={onExportCsv} disabled={isExporting} style={styles.row}>
            <Text style={styles.label}>{t('data.exportCsv')}</Text>
            {isExporting ? (
              <ActivityIndicator color={palette.dim2} />
            ) : (
              <Text style={styles.action}>{t('data.share')}</Text>
            )}
          </Pressable>
          <Text style={styles.cardHint}>{t('data.exportHint')}</Text>
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
