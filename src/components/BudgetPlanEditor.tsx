import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import SegmentedControl from '@react-native-segmented-control/segmented-control';

import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { useIsDark, usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { type BudgetPeriod, type BudgetPlan, periodBounds } from '@utils/budget';
import {
  amountPlaceholder,
  formatMoney,
  minorToAmountInput,
  parseAmountToMinor,
  perDay,
  sanitizeAmountInput,
} from '@utils/money';

interface Props {
  value: BudgetPlan;
  onChange: (plan: BudgetPlan) => void;
  baseCurrency: string;
}

const PERIODS: BudgetPeriod[] = ['week', 'month'];
const PERIOD_LABELS = ['Неделя', 'Месяц'];

/**
 * Budget plan editor — shared by onboarding and Settings → Деньги. The user
 * picks a period (calendar week/month), an amount, and its currency; the daily
 * pace preview is shown in the plan's own currency (plan ÷ days-in-period).
 */
export function BudgetPlanEditor({ value, onChange, baseCurrency }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  // Local editable text; the parent holds the parsed minor amount.
  const [amountText, setAmountText] = useState(() =>
    minorToAmountInput(value.amountMinor, value.currency),
  );

  const periodIndex = Math.max(0, PERIODS.indexOf(value.period));
  const daysInPeriod = periodBounds(value.period, new Date()).daysInPeriod;
  const perDayMinor = perDay(value.amountMinor, daysInPeriod);

  const setPeriod = (period: BudgetPeriod) => onChange({ ...value, period });

  const setAmount = (text: string) => {
    const sanitized = sanitizeAmountInput(text, value.currency);
    setAmountText(sanitized);
    onChange({ ...value, amountMinor: parseAmountToMinor(sanitized, value.currency) ?? 0 });
  };

  const setCurrency = (currency: string) => {
    // Re-parse the existing text against the new currency's precision.
    onChange({ ...value, currency, amountMinor: parseAmountToMinor(amountText, currency) ?? 0 });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>ПЕРИОД</Text>
      <SegmentedControl
        values={PERIOD_LABELS}
        selectedIndex={periodIndex}
        appearance={isDark ? 'dark' : 'light'}
        onChange={(e) => {
          const p = PERIODS[e.nativeEvent.selectedSegmentIndex];
          if (p) setPeriod(p);
        }}
      />

      <Text style={styles.label}>СКОЛЬКО ГОТОВ ТРАТИТЬ</Text>
      <View style={styles.amountRow}>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={setAmount}
          placeholder={amountPlaceholder(value.currency)}
          placeholderTextColor={palette.dim2}
          keyboardType="decimal-pad"
        />
        <CurrencyDropdown value={value.currency} onChange={setCurrency} />
      </View>

      <Text style={styles.preview}>
        {value.amountMinor > 0
          ? `≈ ${formatMoney(perDayMinor, value.currency)} в день` +
            (value.currency !== baseCurrency ? ' · пересчёт в базовую валюту на главной' : '')
          : 'Задайте план, чтобы видеть «можно сегодня».'}
      </Text>
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
    // zIndex keeps the currency dropdown's absolute overlay above the preview below.
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, zIndex: 20 },
    amountInput: {
      ...numberTextStyle,
      flex: 1,
      color: p.ink,
      fontSize: Typography.headline.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    preview: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
  });
