import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScheduleEditor } from '@components/ScheduleEditor';
import { ScreenHeader } from '@components/ScreenHeader';
import { COMMON_CURRENCIES } from '@constants/currencies';
import { DataController } from '@controllers/data.controller';
import { usePalette } from '@hooks/usePalette';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hapticLight } from '@utils/haptics';

export function MoneyScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const setBaseCurrency = useSettingsStore((s) => s.setBaseCurrency);
  const payoutSchedule = useSettingsStore((s) => s.payoutSchedule);
  const setPayoutSchedule = useSettingsStore((s) => s.setPayoutSchedule);

  const onBase = (code: string) => {
    setBaseCurrency(code);
    hapticLight();
    void DataController.loadAll().then(() => DataController.refreshRates());
  };

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Деньги" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>БАЗОВАЯ ВАЛЮТА</Text>
        <View style={styles.chips}>
          {COMMON_CURRENCIES.map((c) => {
            const active = c.code === baseCurrency;
            return (
              <Pressable
                key={c.code}
                onPress={() => onBase(c.code)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.code}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>ВЫПЛАТА</Text>
        <ScheduleEditor
          value={payoutSchedule}
          onChange={setPayoutSchedule}
          baseCurrency={baseCurrency}
        />
        <Text style={styles.hint}>
          «Можно сегодня» = выплата ÷ дни периода (от выплаты до выплаты). Доход с галочкой
          «регулярная выплата» обновляет сумму нужного слота.
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    scroll: { padding: Spacing.screenPadding, gap: Spacing.md },
    sectionTitle: {
      color: p.dim,
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    chipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    chipText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    chipTextActive: { color: p.btnInk },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
  });
