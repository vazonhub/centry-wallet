import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { AppIcon } from '@components/AppIcon';
import { Money } from '@components/Money';
import { openTransactionDetail } from '@components/transactionDetailRef';
import { EXPENSE_FALLBACK_ICON, INCOME_FALLBACK_ICON, TRANSFER_ICON } from '@constants/icons';
import { HistoryController } from '@controllers/history.controller';
import { usePalette } from '@hooks/usePalette';
import type { Category, Transaction } from '@models';
import { useDataStore } from '@stores/data.store';
import { formatMonth, shiftMonth, useHistoryStore } from '@stores/history.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, TAB_BAR_HEIGHT, textProps, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { monthPrefix, todayLocalDay } from '@utils/date';
import { hapticLight } from '@utils/haptics';
import { convertToBase } from '@utils/money';
import { matchesSearch } from '@utils/search';

type Filter = 'all' | 'expense' | 'income' | string; // string = accountId
type Row = { type: 'header'; day: string; net: number } | { type: 'tx'; tx: Transaction };

export function HistoryScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();

  const month = useHistoryStore((s) => s.month);
  const setMonth = useHistoryStore((s) => s.setMonth);
  const earliestMonth = useHistoryStore((s) => s.earliestMonth);
  const transactions = useHistoryStore((s) => s.transactions);
  const income = useHistoryStore((s) => s.incomeBaseMinor);
  const outcome = useHistoryStore((s) => s.outcomeBaseMinor);
  const topCategories = useHistoryStore((s) => s.topCategories);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const base = useSettingsStore((s) => s.baseCurrency);

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])) as Record<string, Category>,
    [categories],
  );

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  // Collapse the per-category bars into one segmented bar once the feed scrolls.
  const [collapsed, setCollapsed] = useState(false);

  // Reload the visible month whenever it changes or the screen refocuses
  // (data may have changed via the input sheet).
  useEffect(() => {
    void HistoryController.loadMonth(month);
  }, [month]);
  useFocusEffect(
    useCallback(() => {
      void HistoryController.loadMonth(month);
    }, [month]),
  );

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      // A transfer is two linked rows; show it once (the source/negative leg).
      if (t.kind === 'transfer' && t.amountMinor > 0) return false;
      if (filter === 'expense' && t.kind !== 'expense') return false;
      if (filter === 'income' && t.kind !== 'income') return false;
      if (filter !== 'all' && filter !== 'expense' && filter !== 'income' && t.accountId !== filter)
        return false;
      if (
        query.trim() &&
        !matchesSearch(query, {
          note: t.note ?? '',
          category: t.categoryId ? (categoryById[t.categoryId]?.name ?? '') : '',
          amountMinor: t.amountMinor,
        })
      )
        return false;
      return true;
    });
  }, [transactions, filter, query, categoryById]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let currentDay = '';
    let dayTxs: Transaction[] = [];
    const flush = () => {
      if (!currentDay) return;
      let net = 0;
      for (const t of dayTxs)
        if (t.kind !== 'transfer') net += convertToBase(t.amountMinor, t.rateToBaseE6);
      out.push({ type: 'header', day: currentDay, net });
      for (const t of dayTxs) out.push({ type: 'tx', tx: t });
    };
    for (const t of filtered) {
      if (t.localDay !== currentDay) {
        flush();
        currentDay = t.localDay;
        dayTxs = [];
      }
      dayTxs.push(t);
    }
    flush();
    return out;
  }, [filtered]);

  const maxTop = topCategories.reduce((m, c) => Math.max(m, c.totalMinor), 0);

  // Segments for the collapsed single bar: each top category by share of the
  // month's spend, plus a neutral "прочее" remainder (iOS Files storage style).
  const catSegments = useMemo(() => {
    const segs = topCategories
      .filter((tc) => tc.totalMinor > 0)
      .map((tc) => ({
        key: tc.categoryId ?? 'none',
        color: (tc.categoryId ? categoryById[tc.categoryId]?.color : undefined) ?? palette.dim,
        minor: tc.totalMinor,
      }));
    const sumTop = segs.reduce((s, x) => s + x.minor, 0);
    const other = outcome - sumTop;
    if (other > 0) segs.push({ key: 'other', color: palette.dim2, minor: other });
    return segs;
  }, [topCategories, categoryById, outcome, palette]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Hysteresis so it doesn't flip-flop right at the threshold. The crossfade
    // + height morph is handled by the reanimated layout animations below.
    const next = collapsed ? y > 24 : y > 56;
    if (next !== collapsed) setCollapsed(next);
  };

  // Clamp navigation: no future months, and no earlier than the first data month.
  const currentMonth = monthPrefix(todayLocalDay());
  const canNext = month < currentMonth;
  const canPrev = earliestMonth ? month > earliestMonth : false;

  const onRowPress = useCallback(
    (tx: Transaction) => {
      openTransactionDetail(tx, () => void HistoryController.loadMonth(month));
    },
    [month],
  );

  // Pin each day header while its transactions scroll under it (sticky dates).
  const stickyHeaderIndices = useMemo(
    () =>
      rows.reduce<number[]>((acc, r, i) => {
        if (r.type === 'header') acc.push(i);
        return acc;
      }, []),
    [rows],
  );

  // Pinned above the scrolling list (owner: month bar fixed on scroll).
  const MonthBar = (
    <View style={styles.monthBar}>
      <View style={styles.monthNav}>
        <Pressable
          disabled={!canPrev}
          onPress={() => setMonth(shiftMonth(month, -1))}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, !canPrev && styles.navArrowDisabled]}>‹</Text>
        </Pressable>
        <Text {...textProps('title')} style={styles.monthTitle}>
          {formatMonth(month)}
        </Text>
        <Pressable
          disabled={!canNext}
          onPress={() => setMonth(shiftMonth(month, 1))}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, !canNext && styles.navArrowDisabled]}>›</Text>
        </Pressable>
      </View>
    </View>
  );

  // Fixed above the scrolling list: month totals + category graphics. On scroll
  // the per-category bars collapse into one proportional segmented bar.
  const FixedStats = (
    <View style={styles.fixedStats}>
      <View style={styles.totals}>
        <View style={styles.totalCard}>
          <Text {...textProps('caption')} style={styles.totalLabel}>
            Пришло
          </Text>
          <Money
            minor={income}
            currency={base}
            style={styles.totalPos}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          />
        </View>
        <View style={styles.totalCard}>
          <Text {...textProps('caption')} style={styles.totalLabel}>
            Ушло
          </Text>
          <Money
            minor={outcome}
            currency={base}
            style={styles.totalNeg}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          />
        </View>
        <View style={styles.totalCard}>
          <Text {...textProps('caption')} style={styles.totalLabel}>
            Разница
          </Text>
          <Money
            minor={income - outcome}
            currency={base}
            options={{ showPlus: true }}
            style={[styles.totalDiff, { color: income - outcome >= 0 ? palette.pos : palette.neg }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          />
        </View>
      </View>

      {outcome > 0 && catSegments.length > 0 && (
        <Animated.View layout={LinearTransition.duration(240)} style={styles.topBlock}>
          <Text {...textProps('micro')} style={styles.sectionTitle}>
            КАТЕГОРИИ ТРАТ
          </Text>
          {collapsed ? (
            <Animated.View
              key="seg"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={styles.segBar}
            >
              {catSegments.map((s) => (
                <View key={s.key} style={{ flex: s.minor, backgroundColor: s.color }} />
              ))}
            </Animated.View>
          ) : (
            <Animated.View
              key="rows"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={styles.barRows}
            >
              {topCategories.map((tc) => {
                const cat = tc.categoryId ? categoryById[tc.categoryId] : undefined;
                const frac = maxTop > 0 ? tc.totalMinor / maxTop : 0;
                return (
                  <View key={tc.categoryId ?? 'none'} style={styles.barRow}>
                    <View style={styles.barIcon}>
                      <AppIcon name={cat?.icon} color={cat?.color ?? palette.dim} size={18} />
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max(6, frac * 100)}%`,
                            backgroundColor: cat?.color ?? palette.dim,
                          },
                        ]}
                      />
                    </View>
                    <Money minor={tc.totalMinor} currency={base} style={styles.barValue} />
                  </View>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      )}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск: заметка, категория, сумма"
        placeholderTextColor={palette.dim2}
        style={styles.search}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filters}
      >
        {(
          [
            { id: 'all', label: 'Все' },
            { id: 'expense', label: 'Расходы' },
            { id: 'income', label: 'Доходы' },
            ...accounts.map((a) => ({ id: a.id, label: a.name })),
          ] as { id: Filter; label: string }[]
        ).map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => {
                setFilter(f.id);
                hapticLight();
              }}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text {...textProps('micro')} style={styles.sectionTitle}>
        ЗАПИСИ
      </Text>
    </View>
  );

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {MonthBar}
        {FixedStats}
        <FlashList
          data={rows}
          onScroll={onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <Text {...textProps('footnote')} style={styles.empty}>
              В этом месяце записей нет.
            </Text>
          }
          keyExtractor={(row) => (row.type === 'header' ? `h:${row.day}` : `t:${row.tx.id}`)}
          getItemType={(row) => row.type}
          stickyHeaderIndices={stickyHeaderIndices}
          contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dayHeader}>
                  <Text {...textProps('caption')} style={styles.dayLabel}>
                    {item.day}
                  </Text>
                  <Money
                    minor={item.net}
                    currency={base}
                    options={{ showPlus: true }}
                    style={styles.dayTotal}
                  />
                </View>
              );
            }
            const t = item.tx;
            const cat = t.categoryId ? categoryById[t.categoryId] : undefined;
            const isTransfer = t.kind === 'transfer';
            const accent = isTransfer ? palette.dim : (cat?.color ?? palette.ink);
            const iconName = isTransfer
              ? TRANSFER_ICON
              : (cat?.icon ?? (t.amountMinor >= 0 ? INCOME_FALLBACK_ICON : EXPENSE_FALLBACK_ICON));
            const title = isTransfer ? 'Перевод' : t.note || cat?.name || 'Без категории';
            return (
              <Pressable
                style={[styles.row, { backgroundColor: hexToRgba(accent, 0.14) }]}
                onPress={() => onRowPress(t)}
              >
                <View style={[styles.rowIconWrap, { backgroundColor: hexToRgba(accent, 0.2) }]}>
                  <AppIcon name={iconName} color={accent} size={18} />
                </View>
                <Text {...textProps('row')} style={styles.rowTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Money
                  minor={t.amountMinor}
                  currency={t.currency}
                  options={{ showPlus: !isTransfer }}
                  style={[
                    styles.rowAmount,
                    { color: t.amountMinor >= 0 && !isTransfer ? palette.pos : palette.ink },
                  ]}
                />
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    safe: { flex: 1 },
    monthBar: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      backgroundColor: p.canvasBase,
    },
    fixedStats: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: Spacing.md,
      backgroundColor: p.canvasBase,
    },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    navArrow: { color: p.ink, fontSize: 28, fontWeight: '400' },
    navArrowDisabled: { color: p.dim2, opacity: 0.4 },
    monthTitle: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '700' },
    totals: { flexDirection: 'row', gap: Spacing.sm },
    totalCard: {
      flex: 1,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      padding: Spacing.md,
      gap: 2,
    },
    totalLabel: { color: p.dim },
    totalPos: { ...numberTextStyle, color: p.pos, fontSize: Typography.headline.fontSize },
    totalNeg: { ...numberTextStyle, color: p.neg, fontSize: Typography.headline.fontSize },
    totalDiff: { ...numberTextStyle, fontSize: Typography.headline.fontSize },
    search: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    // Break the filter row out of the fixed block's padding so it scrolls
    // edge-to-edge, then re-inset the first/last chip via the content padding.
    filtersScroll: { marginHorizontal: -Spacing.screenPadding },
    filters: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.screenPadding },
    filterChip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    filterChipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    filterText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    filterTextActive: { color: p.btnInk },
    topBlock: { gap: Spacing.sm, marginTop: Spacing.sm },
    barRows: { gap: Spacing.sm },
    segBar: {
      flexDirection: 'row',
      height: 14,
      borderRadius: Radius.pill,
      overflow: 'hidden',
      gap: 2,
      backgroundColor: p.glassLightBg,
    },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    barIcon: { width: 24, alignItems: 'center' },
    barTrack: {
      flex: 1,
      height: 10,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      overflow: 'hidden',
    },
    barFill: { height: 10, borderRadius: Radius.pill },
    barValue: { ...numberTextStyle, color: p.dim, fontSize: Typography.caption.fontSize },
    sectionTitle: {
      color: p.dim,
      marginTop: Spacing.md,
      letterSpacing: Typography.micro.letterSpacing,
    },
    empty: {
      color: p.dim2,
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.screenPadding,
      textAlign: 'center',
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
      // Inset to match the rows; own opaque bg so the pinned (sticky) header hides
      // the rows scrolling under it. Horizontal inset lives here (not on the list
      // content) so the pinned header keeps its side padding — FlashList renders
      // sticky headers in a full-width absolute layer that ignores content padding.
      marginHorizontal: Spacing.screenPadding,
      backgroundColor: p.canvasBase,
    },
    dayLabel: { color: p.dim2 },
    dayTotal: { color: p.dim, fontSize: Typography.caption.fontSize },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.listRow,
      marginBottom: Spacing.xs,
      marginHorizontal: Spacing.screenPadding,
    },
    rowIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: p.ink, flex: 1 },
    rowAmount: { fontSize: Typography.row.fontSize },
  });
