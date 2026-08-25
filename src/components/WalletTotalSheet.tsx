import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import { Money } from '@components/Money';
import { walletTotalRef } from '@components/walletTotalRef';
import { StatsController } from '@controllers/stats.controller';
import { usePalette } from '@hooks/usePalette';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import type { BalancePoint } from '@utils/balanceHistory';
import { displayAccountName } from '@utils/displayName';
import { convertToBase } from '@utils/money';
import { totalBalanceBaseMinor } from '@utils/summary';

const E6_ONE = 1_000_000;
const CHART_DAYS = 30;
const CHART_HEIGHT = 120;

/**
 * Wallet-total sheet — how "всего денег" is made up (per-account breakdown
 * converted to base) plus a balance-over-time chart computed on the fly. Opened
 * from the Home total block. Read-only.
 */
export function WalletTotalSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const rates = useDataStore((s) => s.rates);
  const base = useSettingsStore((s) => s.baseCurrency);

  const [series, setSeries] = useState<BalancePoint[]>([]);
  const [open, setOpen] = useState(false);
  // Accounts excluded from the stats (empty = all counted). New accounts default
  // to counted; toggling an account off recomputes the total + chart without it.
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  // The day the user tapped on the chart, or null for the whole-window summary.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const enabledAccounts = useMemo(
    () => accounts.filter((a) => !disabled.has(a.id)),
    [accounts, disabled],
  );

  const total = useMemo(
    () => totalBalanceBaseMinor(enabledAccounts, balances, rates, base),
    [enabledAccounts, balances, rates, base],
  );

  const rateOf = (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE));

  // Recompute the chart whenever the sheet is open and the account selection (or
  // the account list) changes.
  useEffect(() => {
    if (!open) return;
    const ids = enabledAccounts.map((a) => a.id);
    void StatsController.getBalanceSeries(CHART_DAYS, ids).then(setSeries);
  }, [open, enabledAccounts]);

  const onChange = useCallback((index: number) => {
    const isOpen = index >= 0;
    setOpen(isOpen);
    if (!isOpen) setSelectedDay(null);
  }, []);

  const toggleAccount = useCallback((id: string) => {
    setSelectedDay(null);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSelectDay = useCallback((day: string) => {
    setSelectedDay((prev) => (prev === day ? null : day));
  }, []);

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
  );

  return (
    <BottomSheetModal
      ref={walletTotalRef}
      snapPoints={['75%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onChange={onChange}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>{t('walletTotal.totalMoney')}</Text>
        <Money
          minor={total}
          currency={base}
          style={styles.total}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        />

        <BalanceChart
          series={series}
          base={base}
          palette={palette}
          styles={styles}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
          t={t}
        />

        <Text style={styles.sectionLabel}>{t('walletTotal.byAccounts')}</Text>
        <View style={styles.card}>
          {accounts.map((a) => {
            const own = balances[a.id] ?? 0;
            const inBase = convertToBase(own, rateOf(a.currency));
            const foreign = a.currency !== base;
            const enabled = !disabled.has(a.id);
            return (
              <Pressable
                key={a.id}
                style={styles.row}
                onPress={() => toggleAccount(a.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: enabled }}
                accessibilityLabel={t('walletTotal.accountA11y', { name: displayAccountName(a) })}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.checkbox, enabled ? styles.checkboxOn : styles.checkboxOff]}>
                    {enabled && <AppIcon name="checkmark" color={palette.btnInk} size={13} />}
                  </View>
                  <AppIcon
                    name={a.icon}
                    color={enabled ? palette.dim : palette.dim2}
                    size={16}
                    fallback="wallet-outline"
                  />
                  <Text style={[styles.rowName, !enabled && styles.rowMuted]} numberOfLines={1}>
                    {displayAccountName(a)}
                  </Text>
                </View>
                <View style={[styles.rowRight, !enabled && styles.rowFaded]}>
                  <Money minor={own} currency={a.currency} style={styles.rowOwn} />
                  {foreign && <Money minor={inBase} currency={base} style={styles.rowBase} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{t('walletTotal.hint', { base, days: CHART_DAYS })}</Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

interface ChartProps {
  series: BalancePoint[];
  base: string;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

/** 'YYYY-MM-DD' → 'DD.MM' for the selected-day caption. */
function formatDayShort(day: string): string {
  const [, m, d] = day.split('-');
  return d && m ? `${d}.${m}` : day;
}

/**
 * Dependency-free bar chart of the daily wallet total. Bars are scaled to the
 * window's own min/max (every day fits — the tallest reaches full height, the
 * shortest a 4px floor, so no day is clipped). Tapping a bar selects that day
 * and shows its balance; the header otherwise shows the window's net change.
 */
function BalanceChart({ series, base, palette, styles, selectedDay, onSelectDay, t }: ChartProps) {
  if (series.length < 2) return <View style={styles.chartPlaceholder} />;

  const values = series.map((p) => p.totalBaseMinor);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const first = series[0]?.totalBaseMinor ?? 0;
  const last = series[series.length - 1]?.totalBaseMinor ?? 0;
  const change = last - first;
  const selected = selectedDay ? series.find((p) => p.day === selectedDay) : undefined;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartHeaderRow}>
        <Money minor={max} currency={base} style={styles.chartAxis} />
        <View style={styles.chartChange}>
          {selected ? (
            <>
              <Money
                minor={selected.totalBaseMinor}
                currency={base}
                style={[styles.chartChangeText, { color: palette.ink }]}
              />
              <Text style={styles.chartChangeHint}>{formatDayShort(selected.day)}</Text>
            </>
          ) : (
            <>
              <Money
                minor={change}
                currency={base}
                options={{ showPlus: true }}
                style={[styles.chartChangeText, { color: change >= 0 ? palette.pos : palette.neg }]}
              />
              <Text style={styles.chartChangeHint}>
                {t('walletTotal.overDays', { n: series.length })}
              </Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.chartBars}>
        {series.map((p, i) => {
          const frac = range > 0 ? (p.totalBaseMinor - min) / range : 0.5;
          const h = 4 + frac * (CHART_HEIGHT - 4);
          const isLast = i === series.length - 1;
          // When a day is selected, only that bar is highlighted; otherwise the
          // latest day (which equals the shown wallet total) is highlighted.
          const highlighted = selectedDay ? p.day === selectedDay : isLast;
          return (
            <Pressable
              key={p.day}
              style={styles.chartBarWrap}
              onPress={() => onSelectDay(p.day)}
              accessibilityRole="button"
              accessibilityLabel={t('walletTotal.balanceOnA11y', { day: formatDayShort(p.day) })}
            >
              <View
                style={[
                  styles.chartBar,
                  { height: h, backgroundColor: highlighted ? palette.accent : palette.accentSoft },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <Money minor={min} currency={base} style={styles.chartAxis} />
    </View>
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
    label: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
    },
    total: { ...numberTextStyle, color: p.ink, fontSize: Typography.hero.fontSize },
    sectionLabel: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: Spacing.md,
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
      gap: Spacing.md,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1 },
    rowName: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    rowMuted: { color: p.dim2 },
    rowRight: { alignItems: 'flex-end' },
    rowFaded: { opacity: 0.4 },
    rowOwn: { color: p.ink, fontSize: Typography.body.fontSize },
    rowBase: { color: p.dim2, fontSize: Typography.caption.fontSize },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
    },
    checkboxOn: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    checkboxOff: { borderColor: p.dim2 },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
    // Chart
    chartPlaceholder: { height: CHART_HEIGHT + 40 },
    chartWrap: { gap: Spacing.xs },
    chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chartAxis: { color: p.dim2, fontSize: Typography.caption.fontSize },
    chartChange: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
    chartChangeText: { ...numberTextStyle, fontSize: Typography.body.fontSize },
    chartChangeHint: { color: p.dim2, fontSize: Typography.caption.fontSize },
    chartBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: CHART_HEIGHT,
      gap: 2,
    },
    chartBarWrap: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end' },
    chartBar: { width: '100%', borderRadius: 2, minHeight: 4 },
  });
