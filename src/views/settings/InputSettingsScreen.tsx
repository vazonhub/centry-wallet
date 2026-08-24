import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import { parseHhMm, syncEveningReminder } from '@services/notifications';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const CHIP_W = 56;
const pad2 = (n: number) => String(n).padStart(2, '0');

type Styles = ReturnType<typeof makeStyles>;

/**
 * Horizontal strip of tappable numbers — a custom replacement for the native
 * time spinner, which renders broken on the New Architecture (the hour column
 * gets stuck on a handful of values). Pure JS, so behaviour is deterministic.
 */
function NumberStrip({
  values,
  selected,
  onSelect,
  styles,
}: {
  values: number[];
  selected: number;
  onSelect: (n: number) => void;
  styles: Styles;
}) {
  return (
    <FlatList
      horizontal
      data={values}
      extraData={selected}
      keyExtractor={(n) => String(n)}
      showsHorizontalScrollIndicator={false}
      getItemLayout={(_, index) => ({ length: CHIP_W, offset: CHIP_W * index, index })}
      initialScrollIndex={Math.max(0, values.indexOf(selected))}
      contentContainerStyle={styles.stripContent}
      renderItem={({ item }) => {
        const on = item === selected;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={[styles.chip, on && styles.chipOn]}
            hitSlop={6}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{pad2(item)}</Text>
          </Pressable>
        );
      }}
    />
  );
}

export function InputSettingsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const s = useSettingsStore();

  // The reminder time is edited in a modal, committed on "Готово". The row shows
  // the stored 'HH:MM' string (source of truth). The picker is a custom JS strip
  // (NumberStrip) rather than the native DateTimePicker, which is unreliable on
  // the New Architecture here.
  const [pickerOpen, setPickerOpen] = useState(false);
  const initial = parseHhMm(s.eveningPushTime);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const openPicker = () => {
    const { hour: h, minute: m } = parseHhMm(s.eveningPushTime);
    setHour(h);
    setMinute(m);
    setPickerOpen(true);
  };

  const commitPicker = () => {
    s.setEveningPushTime(`${pad2(hour)}:${pad2(minute)}`);
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
          {/* Dismiss on taps outside the sheet; sibling behind so it never eats
              the strip's touches. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Время напоминания</Text>
            <Text style={styles.preview}>{`${pad2(hour)}:${pad2(minute)}`}</Text>

            <Text style={styles.stripLabel}>Часы</Text>
            <NumberStrip values={HOURS} selected={hour} onSelect={setHour} styles={styles} />

            <Text style={styles.stripLabel}>Минуты</Text>
            <NumberStrip values={MINUTES} selected={minute} onSelect={setMinute} styles={styles} />

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
    backdrop: { flex: 1, backgroundColor: p.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: p.sheetBg,
      borderTopLeftRadius: Radius.card,
      borderTopRightRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    sheetTitle: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      fontWeight: '600',
      textAlign: 'center',
    },
    preview: {
      color: p.ink,
      fontSize: 34,
      fontWeight: '700',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      marginBottom: Spacing.xs,
    },
    stripLabel: { color: p.dim2, fontSize: Typography.caption.fontSize },
    stripContent: { gap: Spacing.xs, paddingVertical: Spacing.xs },
    chip: {
      width: CHIP_W - Spacing.xs,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.card,
      backgroundColor: p.glassBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: p.accent },
    chipText: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      fontVariant: ['tabular-nums'],
    },
    chipTextOn: { color: p.canvasBase, fontWeight: '700' },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    action: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    actionMuted: { color: p.dim2, fontSize: Typography.body.fontSize },
    actionPrimary: { color: p.accent, fontSize: Typography.body.fontSize, fontWeight: '600' },
  });
