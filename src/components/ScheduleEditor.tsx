import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { useIsDark, usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { weekdayShort } from '@utils/date';
import { hapticLight } from '@utils/haptics';
import { amountPlaceholder, formatMoney, sanitizeAmountInput } from '@utils/money';
import {
  describeSchedule,
  scheduleSlots,
  type PayoutFrequency,
  type PayoutSchedule,
} from '@utils/schedule';

interface Props {
  value: PayoutSchedule;
  onChange: (next: PayoutSchedule) => void;
  baseCurrency: string;
}

const FREQ_ORDER: PayoutFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
const FREQ_LABELS = ['Неделя', '2 недели', '2×месяц', 'Месяц'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Next occurrence of `weekday` on/after today, as 'YYYY-MM-DD' (biweekly anchor). */
function nextWeekdayAnchor(weekday: number): string {
  const d = new Date();
  const diff = (((weekday - d.getDay()) % 7) + 7) % 7;
  d.setDate(d.getDate() + diff);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Edits a {@link PayoutSchedule}: frequency, weekday / day-of-month, and the
 * expected amount per payout slot. Day selection "feels like a date" via a live
 * preview of the nearest resulting payday (B21 setup, shared by onboarding and
 * Settings → Деньги).
 */
export function ScheduleEditor({ value, onChange, baseCurrency }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = makeStyles(palette);

  // Local text state for amount fields (numeric text kept here; value pushed up).
  const [amountText, setAmountText] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [slotId, v] of Object.entries(value.amounts)) {
      if (v.minor > 0) init[slotId] = formatMoney(v.minor, v.currency, { hideCode: true });
    }
    return init;
  });

  const slotCurrency = (slotId: string): string => value.amounts[slotId]?.currency ?? baseCurrency;

  const setFrequency = (frequency: PayoutFrequency) => {
    const next: PayoutSchedule = { ...value, frequency };
    if (frequency === 'semimonthly') {
      const [a = 10, b = 25] = value.days;
      next.days = a === b ? [10, 25] : [a, b].sort((x, y) => x - y);
    } else if (frequency === 'monthly') {
      next.days = [value.days[0] ?? 1];
    } else if (frequency === 'biweekly') {
      next.anchor = nextWeekdayAnchor(value.weekday);
    }
    onChange(next);
    hapticLight();
  };

  const setWeekday = (weekday: number) => {
    onChange({
      ...value,
      weekday,
      anchor: value.frequency === 'biweekly' ? nextWeekdayAnchor(weekday) : value.anchor,
    });
    hapticLight();
  };

  const setDay = (index: number, day: number) => {
    const days = [...value.days];
    days[index] = day;
    onChange({ ...value, days });
    hapticLight();
  };

  const setAmount = (slotId: string, text: string) => {
    const currency = slotCurrency(slotId);
    const clean = sanitizeAmountInput(text, currency);
    setAmountText((prev) => ({ ...prev, [slotId]: clean }));
    // Parse major → minor (keep 0 for empty; all supported currencies are 2-decimal).
    const norm = clean.replace(',', '.');
    const parsed = clean ? Math.round(parseFloat(norm || '0') * 100) : 0;
    const minor = Number.isFinite(parsed) ? parsed : 0;
    onChange({ ...value, amounts: { ...value.amounts, [slotId]: { minor, currency } } });
  };

  const setSlotCurrency = (slotId: string, currency: string) => {
    const minor = value.amounts[slotId]?.minor ?? 0;
    onChange({ ...value, amounts: { ...value.amounts, [slotId]: { minor, currency } } });
    hapticLight();
  };

  // On blur, normalize the text to the money format (e.g. "100" → "100,00").
  const formatOnBlur = (slotId: string) => {
    const v = value.amounts[slotId];
    if (v && v.minor > 0) {
      setAmountText((prev) => ({
        ...prev,
        [slotId]: formatMoney(v.minor, v.currency, { hideCode: true }),
      }));
    }
  };

  const isWeekly = value.frequency === 'weekly' || value.frequency === 'biweekly';
  const slots = scheduleSlots(value);

  return (
    <View style={styles.wrap}>
      <SegmentedControl
        values={FREQ_LABELS}
        selectedIndex={Math.max(0, FREQ_ORDER.indexOf(value.frequency))}
        appearance={isDark ? 'dark' : 'light'}
        onChange={(e) => {
          const f = FREQ_ORDER[e.nativeEvent.selectedSegmentIndex];
          if (f) setFrequency(f);
        }}
      />

      {isWeekly ? (
        <>
          <Text style={styles.label}>ДЕНЬ НЕДЕЛИ</Text>
          <View style={styles.weekRow}>
            {WEEKDAY_ORDER.map((wd) => {
              const active = wd === value.weekday;
              return (
                <Pressable
                  key={wd}
                  onPress={() => setWeekday(wd)}
                  style={[styles.weekDay, active && styles.weekDayActive]}
                >
                  <Text style={[styles.weekDayText, active && styles.weekDayTextActive]}>
                    {weekdayShort(wd)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <>
          {value.days.map((day, index) => (
            <View key={index}>
              <Text style={styles.label}>
                {value.frequency === 'semimonthly' ? `ДЕНЬ ВЫПЛАТЫ ${index + 1}` : 'ДЕНЬ ВЫПЛАТЫ'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayRow}
              >
                {MONTH_DAYS.map((d) => {
                  const active = d === day;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDay(index, d)}
                      style={[styles.dayCell, active && styles.dayCellActive]}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextActive]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </>
      )}

      <Text style={styles.preview}>{describeSchedule(value)}</Text>

      <Text style={styles.label}>ОЖИДАЕМАЯ ВЫПЛАТА</Text>
      {slots.map((slot) => {
        const currency = slotCurrency(slot.id);
        return (
          <View key={slot.id} style={styles.amountBlock}>
            {slots.length > 1 && <Text style={styles.amountSlot}>{slot.label}</Text>}
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amountText[slot.id] ?? ''}
                onChangeText={(t) => setAmount(slot.id, t)}
                onBlur={() => formatOnBlur(slot.id)}
                placeholder={amountPlaceholder(currency)}
                placeholderTextColor={palette.dim2}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountSuffix}>{currency}</Text>
            </View>
            <CurrencyDropdown value={currency} onChange={(c) => setSlotCurrency(slot.id, c)} />
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.md },
    label: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
    },
    weekRow: { flexDirection: 'row', gap: Spacing.xs },
    weekDay: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      alignItems: 'center',
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    weekDayActive: { backgroundColor: p.accentSoft, borderColor: p.accent },
    weekDayText: { color: p.dim, fontSize: Typography.footnote.fontSize },
    weekDayTextActive: { color: p.accent, fontWeight: '700' },
    dayRow: { gap: Spacing.xs, paddingVertical: 2 },
    dayCell: {
      width: 38,
      height: 38,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    dayCellActive: { backgroundColor: p.accentSoft, borderColor: p.accent },
    dayText: { color: p.dim, fontSize: Typography.footnote.fontSize },
    dayTextActive: { color: p.accent, fontWeight: '700' },
    preview: { color: p.ink, fontSize: Typography.footnote.fontSize },
    amountBlock: { gap: Spacing.xs },
    amountSlot: { color: p.dim, fontSize: Typography.footnote.fontSize },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
      paddingRight: Spacing.lg,
    },
    amountInput: {
      flex: 1,
      color: p.ink,
      fontSize: Typography.headline.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    amountSuffix: { color: p.dim, fontSize: Typography.headline.fontSize, fontWeight: '600' },
  });
