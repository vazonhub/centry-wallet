import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import { parseHhMm, syncEveningReminder } from '@services/notifications';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

/** 'HH:MM' → today's Date at that time (seeds the picker). */
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

  // The time picker lives in a modal with its own draft value, committed on
  // "Готово". Editing inline (display="compact") is unreliable on the New
  // Architecture — it renders the wrong time and fights every keystroke because
  // the store value flows back into the open native popover. A committed draft
  // sidesteps both; the row shows the stored 'HH:MM' string as the source of truth.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => timeToDate(s.eveningPushTime));

  const openPicker = () => {
    setDraft(timeToDate(s.eveningPushTime));
    setPickerOpen(true);
  };

  const commitPicker = () => {
    s.setEveningPushTime(dateToTime(draft));
    void syncEveningReminder();
    setPickerOpen(false);
  };

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
            <Pressable onPress={openPicker} style={[styles.row, styles.rowTop]}>
              <Text style={styles.label}>Время напоминания</Text>
              <Text style={styles.time}>{s.eveningPushTime}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.hint}>
          Напоминание — локальное, ничего не отправляется в сеть. Siri и команды работают на
          устройстве после установки сборки.
        </Text>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          {/* Dismiss on taps OUTSIDE the sheet. Kept as a sibling behind the
              sheet — wrapping the picker in a Pressable steals the wheel's pan
              gesture, so only a couple of values stay reachable. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Время напоминания</Text>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              onChange={(_, d) => {
                if (d) setDraft(d);
              }}
              textColor={palette.ink}
              style={styles.picker}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setPickerOpen(false)} style={styles.action}>
                <Text style={styles.actionMuted}>Отмена</Text>
              </Pressable>
              <Pressable onPress={commitPicker} style={styles.action}>
                <Text style={styles.actionPrimary}>Готово</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    time: { color: p.ink, fontSize: Typography.body.fontSize, fontVariant: ['tabular-nums'] },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize },
    backdrop: {
      flex: 1,
      backgroundColor: p.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: p.sheetBg,
      borderTopLeftRadius: Radius.card,
      borderTopRightRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    sheetTitle: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      fontWeight: '600',
      textAlign: 'center',
    },
    picker: { alignSelf: 'center' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    action: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    actionMuted: { color: p.dim2, fontSize: Typography.body.fontSize },
    actionPrimary: { color: p.pos, fontSize: Typography.body.fontSize, fontWeight: '600' },
  });
