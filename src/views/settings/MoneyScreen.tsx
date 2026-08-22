import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetPlanEditor } from '@components/BudgetPlanEditor';
import { ScreenHeader } from '@components/ScreenHeader';
import { COMMON_CURRENCIES } from '@constants/currencies';
import { DataController } from '@controllers/data.controller';
import { usePalette } from '@hooks/usePalette';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';
import { hapticLight } from '@utils/haptics';

export function MoneyScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const setBaseCurrency = useSettingsStore((s) => s.setBaseCurrency);
  const budgetPlan = useSettingsStore((s) => s.budgetPlan);
  const setBudgetPlan = useSettingsStore((s) => s.setBudgetPlan);

  const onBase = (code: string) => {
    setBaseCurrency(code);
    hapticLight();
    void DataController.loadAll().then(() => DataController.refreshRates());
  };

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Деньги" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        <Text style={styles.sectionTitle}>ПЛАН БЮДЖЕТА</Text>
        <BudgetPlanEditor value={budgetPlan} onChange={setBudgetPlan} baseCurrency={baseCurrency} />
        <Text style={styles.hint}>
          «Можно сегодня» = план ÷ дни периода (календарная неделя или месяц). Это отдельный бюджет
          — приходы и расходы его не меняют.
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
