import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { BudgetPlanEditor } from '@components/BudgetPlanEditor';
import { budgetSheetRef } from '@components/budgetSheetRef';
import { usePalette } from '@hooks/usePalette';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Spacing, Typography } from '@theme';

/**
 * Global budget-plan sheet, opened from the Home hero (openBudgetSheet). Editing
 * the plan in place keeps the user on Home — the previous version navigated into
 * Settings, so the back button dropped them in Settings instead of Home.
 */
export function BudgetSheet() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const budgetPlan = useSettingsStore((s) => s.budgetPlan);
  const setBudgetPlan = useSettingsStore((s) => s.setBudgetPlan);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
  );

  return (
    <BottomSheetModal
      ref={budgetSheetRef}
      snapPoints={['70%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>План бюджета</Text>
        <BudgetPlanEditor
          value={budgetPlan}
          onChange={setBudgetPlan}
          baseCurrency={baseCurrency}
          insideSheet
        />
        <Text style={styles.hint}>
          «Можно сегодня» = план ÷ дни периода (календарная неделя или месяц). Это отдельный бюджет
          — приходы и расходы его не меняют.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    sheetBg: { backgroundColor: p.sheetBg },
    handle: { backgroundColor: p.dim2 },
    content: {
      paddingHorizontal: Spacing.screenPadding,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.md,
    },
    heading: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '600' },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
  });
