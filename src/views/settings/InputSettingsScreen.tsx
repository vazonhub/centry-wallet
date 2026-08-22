import { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import { parseHhMm, syncEveningReminder } from '@services/notifications';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

/** 'HH:MM' → today's Date at that time (for the time picker). */
function timeToDate(time: string): Date {
  const { hour, minute } = parseHhMm(time);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Date → 'HH:MM' (24h, zero-padded). */
function dateToTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InputSettingsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const s = useSettingsStore();

  const rows: { label: string; value: boolean; onChange: (v: boolean) => void }[] = [
    { label: 'Виджет', value: s.inputWidget, onChange: s.setInputWidget },
    { label: 'Siri и команды', value: s.inputSiri, onChange: s.setInputSiri },
    {
      label: 'Вечернее напоминание',
      value: s.inputEveningPush,
      onChange: (v) => {
        s.setInputEveningPush(v);
        // Reconcile the OS-scheduled reminder with the new toggle (etap 8).
        void syncEveningReminder();
      },
    },
  ];

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Ввод" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.label}>{r.label}</Text>
              <Switch
                value={r.value}
                onValueChange={r.onChange}
                trackColor={{ true: palette.pos, false: palette.dim2 }}
              />
            </View>
          ))}
          {s.inputEveningPush && (
            <View style={[styles.row, styles.rowTop]}>
              <Text style={styles.label}>Время напоминания</Text>
              <DateTimePicker
                value={timeToDate(s.eveningPushTime)}
                mode="time"
                display="compact"
                onChange={(_, d) => {
                  if (!d) return;
                  s.setEveningPushTime(dateToTime(d));
                  void syncEveningReminder();
                }}
              />
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          Напоминание — локальное, ничего не отправляется в сеть. Siri и команды работают на
          устройстве после установки сборки.
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
    rowTop: { borderTopColor: p.glassBorder, borderTopWidth: StyleSheet.hairlineWidth },
    label: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize },
  });
