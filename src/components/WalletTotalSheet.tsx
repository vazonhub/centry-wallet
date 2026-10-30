import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import { Skeleton } from '@components/Skeleton';
import {
  walletTotalRef,
  type WalletChartMode,
  type WalletFlow,
  type WalletTotalHandle,
} from '@components/walletTotalRef';
import { StatsController } from '@controllers/stats.controller';
import { usePalette } from '@hooks/usePalette';
import type { Account } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayAccountName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';
import { convertToBase } from '@utils/money';
import { totalBalanceBaseMinor } from '@utils/summary';

const E6_ONE = 1_000_000;
const CHART_DAYS = 30;
const CHART_HEIGHT = 120;

/** What the chart plots — the cumulative wallet balance, or an income/expense flow. */
type ChartKind = 'balance' | 'income' | 'expense';

/** A single plotted bar — unified across all flows and both granularities. */
interface ChartPoint {
  key: string;
  value: number;
  caption: string;
}

/**
 * Wallet-total sheet — how "всего денег" is made up (per-account breakdown
 * converted to base) plus a chart. Two dropdowns drive the chart: a flow filter
 * (all balance / income / expense) and a granularity (by day / by transaction).
 * Opened from the Home total block and the History totals (which preset the two
 * dropdowns). Read-only.
 */
export function WalletTotalSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sheetRef = useRef<BottomSheetModal>(null);

  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const rates = useDataStore((s) => s.rates);
  const base = useSettingsStore((s) => s.baseCurrency);

  // Goals are listed separately below the spend accounts (both toggleable, and
  // goal money still counts toward the total when enabled).
  const spendAccounts = useMemo(() => accounts.filter((a) => a.kind !== 'goal'), [accounts]);
  const goals = useMemo(() => accounts.filter((a) => a.kind === 'goal'), [accounts]);

  const [chart, setChart] = useState<{ kind: ChartKind; points: ChartPoint[] }>({
    kind: 'balance',
    points: [],
  });
  const [chartMode, setChartMode] = useState<WalletChartMode>('byDay');
  const [flow, setFlow] = useState<WalletFlow>('all');
  const [open, setOpen] = useState(false);
  // True while the chart series is being computed — drives the skeleton so a slow
  // (or first) load never flashes the "no data" empty state.
  const [loading, setLoading] = useState(true);
  // Accounts excluded from the stats (empty = all counted). New accounts default
  // to counted; toggling an account off recomputes the total + chart without it.
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  // The bar (day or transaction) the user tapped, or null for the window summary.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useImperativeHandle(
    walletTotalRef,
    (): WalletTotalHandle => ({
      open(preset) {
        setSelectedKey(null);
        setLoading(true); // show the skeleton immediately, before the fetch starts
        if (preset?.flow) setFlow(preset.flow);
        if (preset?.mode) setChartMode(preset.mode);
        sheetRef.current?.present();
      },
    }),
    [],
  );

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
  // flow, or the granularity changes. A cancel flag drops a stale async result if
  // the inputs change again before it resolves.
  useEffect(() => {
    if (!open) return;
    const ids = enabledAccounts.map((a) => a.id);
    let cancelled = false;
    const run = async () => {
      if (flow === 'all') {
        const s =
          chartMode === 'byTx'
            ? await StatsController.getTransactionSeries(CHART_DAYS, ids)
            : await StatsController.getBalanceSeries(CHART_DAYS, ids);
        if (cancelled) return;
        setChart({
          kind: 'balance',
          points: s.map((p) => ({
            key: 'index' in p ? `t${p.index}` : p.day,
            value: p.totalBaseMinor,
            caption: formatDayShort(p.day),
          })),
        });
      } else {
        const s =
          chartMode === 'byTx'
            ? await StatsController.getFlowTxSeries(flow, CHART_DAYS, ids)
            : await StatsController.getFlowDaySeries(flow, CHART_DAYS, ids);
        if (cancelled) return;
        setChart({
          kind: flow,
          points: s.map((p, i) => ({
            key: chartMode === 'byTx' ? `t${i}` : p.day,
            value: p.valueBaseMinor,
            caption: formatDayShort(p.day),
          })),
        });
      }
      if (!cancelled) setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, enabledAccounts, chartMode, flow]);

  const changeCaption =
    chartMode === 'byTx'
      ? t('walletTotal.overTx', { n: chart.points.length })
      : t('walletTotal.overDays', { n: chart.points.length });

  const onChange = useCallback((index: number) => {
    const isOpen = index >= 0;
    setOpen(isOpen);
    if (!isOpen) setSelectedKey(null);
  }, []);

  // Toggling accounts / switching flow or granularity all trigger a refetch — flip
  // the skeleton on here (not in the effect, which mustn't setState synchronously).
  const toggleAccount = useCallback((id: string) => {
    setSelectedKey(null);
    setLoading(true);
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

  const onModeChange = useCallback((mode: WalletChartMode) => {
    setSelectedKey(null);
    setLoading(true);
    setChartMode(mode);
  }, []);

  const onFlowChange = useCallback((f: WalletFlow) => {
    setSelectedKey(null);
    setLoading(true);
    setFlow(f);
  }, []);

  const flowColor =
    chart.kind === 'income' ? palette.pos : chart.kind === 'expense' ? palette.neg : undefined;

  const flowOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('walletTotal.flowAll') },
      { value: 'income' as const, label: t('walletTotal.flowIncome') },
      { value: 'expense' as const, label: t('walletTotal.flowExpense') },
    ],
    [t],
  );
  const modeOptions = useMemo(
    () => [
      { value: 'byDay' as const, label: t('walletTotal.chartByDay') },
      { value: 'byTx' as const, label: t('walletTotal.chartByTx') },
    ],
    [t],
  );

  // Shared row for both the accounts and goals lists. Goals show their colour dot
  // instead of an icon, so they read as a distinct series in the breakdown.
  const renderRow = (a: Account) => {
    const own = balances[a.id] ?? 0;
    const inBase = convertToBase(own, rateOf(a.currency));
    const foreign = a.currency !== base;
    const enabled = !disabled.has(a.id);
    const isGoal = a.kind === 'goal';
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
          {isGoal ? (
            <View style={[styles.goalDot, { backgroundColor: a.color ?? palette.accent }]} />
          ) : (
            <AppIcon
              name={a.icon}
              color={enabled ? palette.dim : palette.dim2}
              size={16}
              fallback="wallet-outline"
            />
          )}
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
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['75%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onChange={onChange}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {/* Header: total money on the left, chart dropdowns in the top-right. */}
        <View style={styles.headerRow}>
          <Text style={styles.label}>{t('walletTotal.totalMoney')}</Text>
          <View style={styles.dropdowns}>
            <Dropdown
              value={flow}
              options={flowOptions}
              onChange={onFlowChange}
              palette={palette}
              styles={styles}
            />
            <Dropdown
              value={chartMode}
              options={modeOptions}
              onChange={onModeChange}
              palette={palette}
              styles={styles}
            />
          </View>
        </View>
        <Money
          minor={total}
          currency={base}
          style={styles.total}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        />

        {/* Fixed-height slot so the chart never nudges the layout up/down when the
            flow/granularity changes (or when it falls back to the placeholder). */}
        <View style={styles.chartSlot}>
          <BalanceChart
            points={chart.points}
            base={base}
            palette={palette}
            styles={styles}
            selectedKey={selectedKey}
            onSelectKey={onSelectKey}
            changeCaption={changeCaption}
            zeroBaseline={chart.kind !== 'balance'}
            flowColor={flowColor}
            loading={loading}
            t={t}
          />
        </View>

        <Text style={styles.sectionLabel}>{t('walletTotal.byAccounts')}</Text>
        <View style={styles.card}>{spendAccounts.map(renderRow)}</View>

        {goals.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('walletTotal.goals')}</Text>
            <View style={styles.card}>{goals.map(renderRow)}</View>
          </>
        )}

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
  /** Caption for the window summary (e.g. "over 30 d." / "over 42 tx."). */
  changeCaption: string;
  /** Flow charts sit on a zero baseline and sum (not net) their bars. */
  zeroBaseline: boolean;
  /** Bar/summary tint for flow charts (income green / expense red); undefined = balance. */
  flowColor?: string;
  /** While true the chart is still being computed — show the skeleton, not "no data". */
  loading: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}

/** Deterministic bar heights (fractions of the plot height) for the skeleton. */
const SKELETON_BARS = [0.4, 0.6, 0.35, 0.7, 0.5, 0.85, 0.45, 0.65, 0.55, 0.75, 0.4, 0.6, 0.5, 0.8];

/** 'YYYY-MM-DD' → 'DD.MM' for the selected-bar caption. */
function formatDayShort(day: string): string {
  const [, m, d] = day.split('-');
  return d && m ? `${d}.${m}` : day;
}

/**
 * Dependency-free bar chart — one bar per day or (in by-tx mode) per transaction.
 * In balance mode bars are scaled to the window's min/max and the header shows the
 * net change (last − first), the latest bar highlighted (it equals the wallet
 * total). In flow mode bars grow from a zero baseline and the header shows the
 * window total (Σ), tinted by the flow. Tapping a bar shows its own value.
 */
function BalanceChart({
  points,
  base,
  palette,
  styles,
  selectedKey,
  onSelectKey,
  changeCaption,
  zeroBaseline,
  flowColor,
  loading,
  t,
}: ChartProps) {
  // Loading (skeleton) and empty ("no data") are distinct states: only fall back
  // to the empty state once the fetch has finished and still has nothing to plot.
  if (loading) {
    return (
      <View style={styles.chartWrap}>
        <View style={styles.chartHeaderRow}>
          <Skeleton width={56} height={12} />
          <Skeleton width={84} height={12} />
        </View>
        <View style={styles.chartBars}>
          {SKELETON_BARS.map((f, i) => (
            <View key={i} style={styles.chartBarWrap}>
              <Skeleton width="100%" height={4 + f * (CHART_HEIGHT - 4)} radius={2} />
            </View>
          ))}
        </View>
        <Skeleton width={56} height={12} />
      </View>
    );
  }
  if (points.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <AppIcon name="stats-chart" color={palette.dim2} size={22} />
        <Text style={styles.chartEmptyText}>{t('walletTotal.chartEmpty')}</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const max = zeroBaseline ? Math.max(...values, 0) : Math.max(...values);
  const min = zeroBaseline ? 0 : Math.min(...values);
  const range = max - min;
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const summaryMinor = zeroBaseline ? values.reduce((a, b) => a + b, 0) : last - first;
  const summaryColor = zeroBaseline
    ? (flowColor ?? palette.ink)
    : summaryMinor >= 0
      ? palette.pos
      : palette.neg;
  const barColor = flowColor ?? palette.accent;
  const barSoft = zeroBaseline ? hexToRgba(barColor, 0.4) : palette.accentSoft;
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
                minor={summaryMinor}
                currency={base}
                options={{ showPlus: !zeroBaseline }}
                style={[styles.chartChangeText, { color: summaryColor }]}
              />
              <Text style={styles.chartChangeHint}>{changeCaption}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.chartBars}>
        {points.map((p, i) => {
          const frac = range > 0 ? (p.value - min) / range : zeroBaseline ? 0 : 0.5;
          const h = 4 + frac * (CHART_HEIGHT - 4);
          const isLast = i === points.length - 1;
          // In balance mode the latest bar (= wallet total) is highlighted when
          // nothing is selected; flow charts highlight only the tapped bar.
          const highlighted = selectedKey ? p.key === selectedKey : !zeroBaseline && isLast;
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
                  { height: h, backgroundColor: highlighted ? barColor : barSoft },
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

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
}

/**
 * Compact dropdown mirroring the app's CurrencyDropdown idiom: a pill field with
 * a chevron whose open list is an ABSOLUTE overlay so it floats over the content
 * below instead of reflowing it.
 */
function Dropdown<T extends string>({
  value,
  options,
  onChange,
  palette,
  styles,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

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
        <Text style={styles.ddFieldText} numberOfLines={1}>
          {current?.label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={palette.dim} />
      </Pressable>
      {open && (
        <View style={styles.ddList}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                style={styles.ddItem}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                  hapticLight();
                }}
              >
                <Text
                  style={[styles.ddItemText, active && styles.ddItemTextActive]}
                  numberOfLines={1}
                >
                  {o.label}
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
    // Header — small label left, dropdowns top-right; the big total sits below.
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      zIndex: 1000,
    },
    dropdowns: { flexDirection: 'row', gap: Spacing.sm, flexShrink: 0 },
    label: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
      flexShrink: 1,
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
    goalDot: { width: 14, height: 14, borderRadius: 7 },
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
    // Chart — a fixed-height slot keeps everything below it from shifting.
    chartSlot: { height: CHART_HEIGHT + 52 },
    chartWrap: { flex: 1, gap: Spacing.xs },
    chartEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    chartEmptyText: { color: p.dim2, fontSize: Typography.footnote.fontSize },
    chartHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 22,
    },
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
    // Dropdowns — the open list floats (absolute) so it never pushes the chart down.
    ddRoot: { position: 'relative', maxWidth: 150 },
    ddRootOpen: { zIndex: 1000 },
    ddField: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
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
      // Anchor to the field's right edge and grow leftward so the list never
      // runs off the right screen edge (both dropdowns sit in the top-right).
      right: 0,
      marginTop: Spacing.xs,
      minWidth: 150,
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
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    ddItemText: { color: p.dim, fontSize: Typography.footnote.fontSize, flexShrink: 1 },
    ddItemTextActive: { color: p.ink, fontWeight: '600' },
  });
