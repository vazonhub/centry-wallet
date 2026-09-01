import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import type { BalancePoint, TxBalancePoint } from '@utils/balanceHistory';
import { displayAccountName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';
import { convertToBase } from '@utils/money';
import { totalBalanceBaseMinor } from '@utils/summary';

const E6_ONE = 1_000_000;
const CHART_DAYS = 30;
const CHART_HEIGHT = 120;

type ChartMode = 'byDay' | 'byTx';

/** A single plotted bar — unified across the by-day and by-transaction modes. */
interface ChartPoint {
  key: string;
  value: number;
  caption: string;
}

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
  const [txSeries, setTxSeries] = useState<TxBalancePoint[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('byDay');
  const [open, setOpen] = useState(false);
  // Accounts excluded from the stats (empty = all counted). New accounts default
  // to counted; toggling an account off recomputes the total + chart without it.
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  // The bar (day or transaction) the user tapped, or null for the window summary.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const enabledAccounts = useMemo(
    () => accounts.filter((a) => !disabled.has(a.id)),
    [accounts, disabled],
  );

  const total = useMemo(
    () => totalBalanceBaseMinor(enabledAccounts, balances, rates, base),
    [enabledAccounts, balances, rates, base],
  );

  const rateOf = (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE));

  // Recompute the chart whenever the sheet is open and the account selection, the
  // account list, or the chart mode changes. Only the active mode's series is
  // fetched (the other stays as-is until switched to).
  useEffect(() => {
    if (!open) return;
    const ids = enabledAccounts.map((a) => a.id);
    if (chartMode === 'byTx') {
      void StatsController.getTransactionSeries(CHART_DAYS, ids).then(setTxSeries);
    } else {
      void StatsController.getBalanceSeries(CHART_DAYS, ids).then(setSeries);
    }
  }, [open, enabledAccounts, chartMode]);

  // Unified plot points for whichever mode is active (both key their caption to
  // the day; the by-tx mode just has one point per transaction).
  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (chartMode === 'byTx') {
      return txSeries.map((p) => ({
        key: `t${p.index}`,
        value: p.totalBaseMinor,
        caption: formatDayShort(p.day),
      }));
    }
    return series.map((p) => ({
      key: p.day,
      value: p.totalBaseMinor,
      caption: formatDayShort(p.day),
    }));
  }, [chartMode, series, txSeries]);

  const changeCaption =
    chartMode === 'byTx'
      ? t('walletTotal.overTx', { n: chartPoints.length })
      : t('walletTotal.overDays', { n: chartPoints.length });

  const onChange = useCallback((index: number) => {
    const isOpen = index >= 0;
    setOpen(isOpen);
    if (!isOpen) setSelectedKey(null);
  }, []);

  const toggleAccount = useCallback((id: string) => {
    setSelectedKey(null);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSelectKey = useCallback((key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  }, []);

  const onModeChange = useCallback((mode: ChartMode) => {
    setSelectedKey(null);
    setChartMode(mode);
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

        <View style={styles.chartControls}>
          <ChartModeDropdown
            mode={chartMode}
            onChange={onModeChange}
            palette={palette}
            styles={styles}
            t={t}
          />
        </View>

        <BalanceChart
          points={chartPoints}
          base={base}
          palette={palette}
          styles={styles}
          selectedKey={selectedKey}
          onSelectKey={onSelectKey}
          changeCaption={changeCaption}
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
  points: ChartPoint[];
  base: string;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
  /** Caption for the window net-change (e.g. "over 30 d." / "over 42 tx."). */
  changeCaption: string;
  t: ReturnType<typeof useTranslation>['t'];
}

/** 'YYYY-MM-DD' → 'DD.MM' for the selected-bar caption. */
function formatDayShort(day: string): string {
  const [, m, d] = day.split('-');
  return d && m ? `${d}.${m}` : day;
}

/**
 * Dependency-free bar chart of the wallet total — one bar per day or (in by-tx
 * mode) per transaction. Bars are scaled to the window's own min/max (every bar
 * fits — the tallest reaches full height, the shortest a 4px floor, so nothing is
 * clipped). Tapping a bar selects it and shows its balance; the header otherwise
 * shows the window's net change.
 */
function BalanceChart({
  points,
  base,
  palette,
  styles,
  selectedKey,
  onSelectKey,
  changeCaption,
  t,
}: ChartProps) {
  if (points.length < 2) return <View style={styles.chartPlaceholder} />;

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const change = last - first;
  const selected = selectedKey ? points.find((p) => p.key === selectedKey) : undefined;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartHeaderRow}>
        <Money minor={max} currency={base} style={styles.chartAxis} />
        <View style={styles.chartChange}>
          {selected ? (
            <>
              <Money
                minor={selected.value}
                currency={base}
                style={[styles.chartChangeText, { color: palette.ink }]}
              />
              <Text style={styles.chartChangeHint}>{selected.caption}</Text>
            </>
          ) : (
            <>
              <Money
                minor={change}
                currency={base}
                options={{ showPlus: true }}
                style={[styles.chartChangeText, { color: change >= 0 ? palette.pos : palette.neg }]}
              />
              <Text style={styles.chartChangeHint}>{changeCaption}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.chartBars}>
        {points.map((p, i) => {
          const frac = range > 0 ? (p.value - min) / range : 0.5;
          const h = 4 + frac * (CHART_HEIGHT - 4);
          const isLast = i === points.length - 1;
          // When a bar is selected, only that one is highlighted; otherwise the
          // latest bar (which equals the shown wallet total) is highlighted.
          const highlighted = selectedKey ? p.key === selectedKey : isLast;
          return (
            <Pressable
              key={p.key}
              style={styles.chartBarWrap}
              onPress={() => onSelectKey(p.key)}
              accessibilityRole="button"
              accessibilityLabel={t('walletTotal.balanceOnA11y', { day: p.caption })}
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

interface DropdownProps {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
  t: ReturnType<typeof useTranslation>['t'];
}

/**
 * Compact chart-mode dropdown (by day / by transaction), mirroring the app's
 * CurrencyDropdown idiom: a pill field with a chevron whose open list is an
 * ABSOLUTE overlay so it floats over the chart instead of reflowing it.
 */
function ChartModeDropdown({ mode, onChange, palette, styles, t }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const labelOf = (m: ChartMode) =>
    m === 'byTx' ? t('walletTotal.chartByTx') : t('walletTotal.chartByDay');

  return (
    <View style={[styles.ddRoot, open && styles.ddRootOpen]}>
      <Pressable
        style={styles.ddField}
        onPress={() => {
          setOpen((o) => !o);
          hapticLight();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.ddFieldText}>{labelOf(mode)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={palette.dim} />
      </Pressable>
      {open && (
        <View style={styles.ddList}>
          {(['byDay', 'byTx'] as const).map((m) => {
            const active = m === mode;
            return (
              <Pressable
                key={m}
                style={styles.ddItem}
                onPress={() => {
                  onChange(m);
                  setOpen(false);
                  hapticLight();
                }}
              >
                <Text style={[styles.ddItemText, active && styles.ddItemTextActive]}>
                  {labelOf(m)}
                </Text>
                {active && <Ionicons name="checkmark" size={16} color={palette.accent} />}
              </Pressable>
            );
          })}
        </View>
      )}
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
    // Chart-mode dropdown — right-aligned above the chart. The open list floats
    // (absolute) so it never pushes the chart down.
    chartControls: { flexDirection: 'row', justifyContent: 'flex-end', zIndex: 1000 },
    ddRoot: { position: 'relative', minWidth: 168 },
    ddRootOpen: { zIndex: 1000 },
    ddField: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    ddFieldText: { flexShrink: 1, color: p.ink, fontSize: Typography.footnote.fontSize },
    ddList: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.xs,
      borderRadius: Radius.md,
      backgroundColor: p.sheetBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      overflow: 'hidden',
      zIndex: 1000,
      elevation: 12,
      shadowColor: p.glassShadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    ddItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    ddItemText: { color: p.dim, fontSize: Typography.footnote.fontSize },
    ddItemTextActive: { color: p.ink, fontWeight: '600' },
  });
