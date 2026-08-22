import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const rates = useDataStore((s) => s.rates);
  const base = useSettingsStore((s) => s.baseCurrency);

  const [series, setSeries] = useState<BalancePoint[]>([]);

  const total = useMemo(
    () => totalBalanceBaseMinor(accounts, balances, rates, base),
    [accounts, balances, rates, base],
  );

  const rateOf = (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE));

  const onChange = (index: number) => {
    if (index < 0) return;
    void StatsController.getBalanceSeries(CHART_DAYS).then(setSeries);
  };

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
        <Text style={styles.label}>ВСЕГО ДЕНЕГ</Text>
        <Money
          minor={total}
          currency={base}
          style={styles.total}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        />

        <BalanceChart series={series} base={base} palette={palette} styles={styles} />

        <Text style={styles.sectionLabel}>ПО СЧЕТАМ</Text>
        <View style={styles.card}>
          {accounts.map((a) => {
            const own = balances[a.id] ?? 0;
            const inBase = convertToBase(own, rateOf(a.currency));
            const foreign = a.currency !== base;
            return (
              <View key={a.id} style={styles.row}>
                <View style={styles.rowLeft}>
                  <AppIcon name={a.icon} color={palette.dim} size={16} fallback="wallet-outline" />
                  <Text style={styles.rowName} numberOfLines={1}>
                    {a.name}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Money minor={own} currency={a.currency} style={styles.rowOwn} />
                  {foreign && <Money minor={inBase} currency={base} style={styles.rowBase} />}
                </View>
              </View>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Суммы в других валютах пересчитаны в {base} по текущему курсу. График — баланс за
          последние {CHART_DAYS} дней.
        </Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

interface ChartProps {
  series: BalancePoint[];
  base: string;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
}

/** Dependency-free bar chart of the daily wallet total (relative to its range). */
function BalanceChart({ series, base, palette, styles }: ChartProps) {
  if (series.length < 2) return <View style={styles.chartPlaceholder} />;

  const values = series.map((p) => p.totalBaseMinor);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const first = series[0]?.totalBaseMinor ?? 0;
  const last = series[series.length - 1]?.totalBaseMinor ?? 0;
  const change = last - first;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartHeaderRow}>
        <Money minor={max} currency={base} style={styles.chartAxis} />
        <View style={styles.chartChange}>
          <Money
            minor={change}
            currency={base}
            options={{ showPlus: true }}
            style={[styles.chartChangeText, { color: change >= 0 ? palette.pos : palette.neg }]}
          />
          <Text style={styles.chartChangeHint}>за {series.length} дн.</Text>
        </View>
      </View>
      <View style={styles.chartBars}>
        {series.map((p, i) => {
          const frac = range > 0 ? (p.totalBaseMinor - min) / range : 0.5;
          const h = 4 + frac * (CHART_HEIGHT - 4);
          const isLast = i === series.length - 1;
          return (
            <View
              key={p.day}
              style={[
                styles.chartBar,
                { height: h, backgroundColor: isLast ? palette.accent : palette.accentSoft },
              ]}
            />
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
    rowRight: { alignItems: 'flex-end' },
    rowOwn: { color: p.ink, fontSize: Typography.body.fontSize },
    rowBase: { color: p.dim2, fontSize: Typography.caption.fontSize },
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
    chartBar: { flex: 1, borderRadius: 2, minHeight: 4 },
  });
