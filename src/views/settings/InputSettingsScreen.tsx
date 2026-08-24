import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import { parseHhMm, syncEveningReminder } from '@services/notifications';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad2 = (n: number) => String(n).padStart(2, '0');

// Vertical wheel geometry.
const ITEM_H = 44;
const VISIBLE = 5; // odd, so one row sits dead-centre under the selection band
const WHEEL_H = ITEM_H * VISIBLE;
const WHEEL_PAD = (WHEEL_H - ITEM_H) / 2;

type Styles = ReturnType<typeof makeStyles>;

/**
 * A vertical scroll wheel — a custom replacement for the native time spinner,
 * which renders broken on the New Architecture (the hour column gets stuck on a
 * few values). A plain ScrollView with snap: it is not reset by parent
 * re-renders, so updating the selection on scroll-end never fights the wheel.
 */
function WheelColumn({
  values,
  selected,
  onChange,
  styles,
}: {
  values: number[];
  selected: number;
  onChange: (n: number) => void;
  styles: Styles;
}) {
  const ref = useRef<ScrollView>(null);
  const initialIndex = Math.max(0, values.indexOf(selected));

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const v = values[Math.min(values.length - 1, Math.max(0, idx))];
    if (v !== undefined && v !== selected) onChange(v);
  };

  const tap = (v: number, index: number) => {
    onChange(v);
    ref.current?.scrollTo({ y: index * ITEM_H, animated: true });
  };

  return (
    <ScrollView
      ref={ref}
      style={styles.wheel}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
      onMomentumScrollEnd={onScrollEnd}
      contentContainerStyle={styles.wheelContent}
    >
      {values.map((v, i) => (
        <Pressable key={v} onPress={() => tap(v, i)} style={styles.wheelItem}>
          <Text style={[styles.wheelText, v === selected && styles.wheelTextOn]}>{pad2(v)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function InputSettingsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const s = useSettingsStore();

  // The reminder time is edited in a modal, committed on "Готово". The row shows
  // the stored 'HH:MM' string (source of truth), so the displayed time always
  // matches what is scheduled. `nonce` forces the wheels to remount on each open
  // so they re-seed their scroll position (and "Отмена" simply leaves the store
  // untouched — the next open reseeds from it).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const initial = parseHhMm(s.eveningPushTime);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);

  const openPicker = () => {
    const { hour: h, minute: m } = parseHhMm(s.eveningPushTime);
    setHour(h);
    setMinute(m);
    setNonce((n) => n + 1);
    setPickerOpen(true);
  };

  const commitPicker = () => {
    s.setEveningPushTime(`${pad2(hour)}:${pad2(minute)}`);
    void syncEveningReminder();
    setPickerOpen(false);
  };

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
        <Text style={styles.section}>SIRI И КОМАНДЫ</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Добавлять голосом</Text>
            <Switch
              value={s.inputSiri}
              onValueChange={s.setInputSiri}
              trackColor={{ true: palette.accent, false: palette.dim2 }}
            />
          </View>
          <Text style={styles.cardHint}>
            «Привет, Siri, добавить трату в Centry» — откроется ввод, заполненный из фразы. Работает
            на устройстве (iOS 18+). Выключено — Siri открывает пустой ввод.
          </Text>
        </View>

        <Text style={styles.section}>НАПОМИНАНИЕ</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Вечернее напоминание</Text>
            <Switch
              value={s.inputEveningPush}
              onValueChange={(v) => {
                s.setInputEveningPush(v);
                void syncEveningReminder();
              }}
              trackColor={{ true: palette.accent, false: palette.dim2 }}
            />
          </View>
          {s.inputEveningPush && (
            <Pressable onPress={openPicker} style={[styles.row, styles.rowTop]}>
              <Text style={styles.label}>Время</Text>
              <Text style={styles.time}>{s.eveningPushTime}</Text>
            </Pressable>
          )}
          <Text style={styles.cardHint}>
            Локальное напоминание записать траты за день. Ничего не отправляется в сеть.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          {/* Dismiss on taps outside the sheet; sibling behind so it never eats
              the wheels' touches. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Время напоминания</Text>
            <View style={styles.wheels}>
              <WheelColumn
                key={`h-${nonce}`}
                values={HOURS}
                selected={hour}
                onChange={setHour}
                styles={styles}
              />
              <Text style={styles.colon}>:</Text>
              <WheelColumn
                key={`m-${nonce}`}
                values={MINUTES}
                selected={minute}
                onChange={setMinute}
                styles={styles}
              />
              <View pointerEvents="none" style={styles.band} />
            </View>
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
    rowTop: { borderTopColor: p.glassBorder, borderTopWidth: StyleSheet.hairlineWidth },
    label: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    time: { color: p.accent, fontSize: Typography.body.fontSize, fontVariant: ['tabular-nums'] },
    cardHint: { color: p.dim2, fontSize: Typography.footnote.fontSize, paddingTop: Spacing.xs },
    // --- time picker modal ---
    backdrop: { flex: 1, backgroundColor: p.scrim, justifyContent: 'flex-end' },
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
    wheels: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    wheel: { height: WHEEL_H, width: 68 },
    wheelContent: { paddingVertical: WHEEL_PAD },
    wheelItem: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
    wheelText: { color: p.dim2, fontSize: 24, fontVariant: ['tabular-nums'] },
    wheelTextOn: { color: p.ink, fontWeight: '700' },
    colon: { color: p.ink, fontSize: 24, fontWeight: '700' },
    band: {
      position: 'absolute',
      left: Spacing.xxxl,
      right: Spacing.xxxl,
      top: WHEEL_PAD,
      height: ITEM_H,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    action: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
    actionMuted: { color: p.dim2, fontSize: Typography.body.fontSize },
    actionPrimary: { color: p.accent, fontSize: Typography.body.fontSize, fontWeight: '600' },
  });
