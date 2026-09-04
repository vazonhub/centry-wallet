import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';

import { AppIcon } from '@components/AppIcon';
import { GlassButton } from '@components/GlassButton';
import { Money } from '@components/Money';
import { Skeleton } from '@components/Skeleton';
import { TransferAmount } from '@components/TransferAmount';
import { openTransactionDetail } from '@components/transactionDetailRef';
import { openWalletTotal } from '@components/walletTotalRef';
import { EXPENSE_FALLBACK_ICON, INCOME_FALLBACK_ICON, TRANSFER_ICON } from '@constants/icons';
import { HistoryController } from '@controllers/history.controller';
import { useReduceMotion } from '@hooks/useAccessibility';
import { usePalette } from '@hooks/usePalette';
import type { Category, Transaction } from '@models';
import { useDataStore } from '@stores/data.store';
import { formatMonth, shiftMonth, useHistoryStore } from '@stores/history.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, TAB_BAR_HEIGHT, textProps, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { monthPrefix, todayLocalDay } from '@utils/date';
import { hapticLight } from '@utils/haptics';
import { convertToBase } from '@utils/money';
import { matchesSearch } from '@utils/search';

type Filter = 'all' | 'expense' | 'income' | string; // string = accountId
type Row = { type: 'header'; day: string; net: number } | { type: 'tx'; tx: Transaction };

/**
 * Minimum overscrollable distance (content − viewport, px) before the category
 * block is allowed to collapse. Must exceed the height that block reclaims, or
 * collapsing would grow the viewport enough to bounce the offset back and
 * re-expand — a flip-flop loop on short months.
 */
const COLLAPSE_MIN_SCROLL = 160;

/** Height of the collapsed summary bar (keep in sync with styles.segBar). */
const SEGBAR_H = 10;
/** Half-base / height of the tooltip's downward caret. */
const TOOLTIP_CARET = 6;
/** How long the segment tooltip stays up before auto-dismissing (ms). */
const TOOLTIP_TIMEOUT = 2600;

export function HistoryScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const insets = useSafeAreaInsets();
  // Reduce Motion: collapse instantly instead of gliding.
  const collapseDuration = useReduceMotion() ? 0 : 240;

  // Short month labels for the month/year picker grid.
  const monthsShort = useMemo(
    () => t('history.monthsShort', { returnObjects: true }) as string[],
    [t],
  );

  const month = useHistoryStore((s) => s.month);
  const setMonth = useHistoryStore((s) => s.setMonth);
  const earliestMonth = useHistoryStore((s) => s.earliestMonth);
  const transactions = useHistoryStore((s) => s.transactions);
  const income = useHistoryStore((s) => s.incomeBaseMinor);
  const outcome = useHistoryStore((s) => s.outcomeBaseMinor);
  const topCategories = useHistoryStore((s) => s.topCategories);
  const loading = useHistoryStore((s) => s.loading);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const base = useSettingsStore((s) => s.baseCurrency);

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])) as Record<string, Category>,
    [categories],
  );

  // First open of a month with nothing loaded yet → show skeletons (not the empty
  // state). Switching months keeps the previous data visible until the new lands.
  const firstLoad = loading && transactions.length === 0;

  // Destination leg of each transfer, keyed by pair id (for "source → dest").
  const transferToLeg = useMemo(() => {
    const m = new Map<string, Transaction>();
    for (const tr of transactions) {
      if (tr.kind === 'transfer' && tr.amountMinor > 0 && tr.transferPairId) {
        m.set(tr.transferPairId, tr);
      }
    }
    return m;
  }, [transactions]);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  // Collapse the per-category bars into one segmented bar once the feed scrolls.
  const [collapsed, setCollapsed] = useState(false);
  // Tooltip over a tapped segment of the collapsed summary bar (icon + name +
  // amount, centred on the segment). Layouts feed the horizontal positioning.
  const [activeSeg, setActiveSeg] = useState<string | null>(null);
  const [segBarW, setSegBarW] = useState(0);
  const [tipW, setTipW] = useState(0);
  const [segLayouts, setSegLayouts] = useState<Record<string, { x: number; width: number }>>({});
  // In the expanded bars view a tapped row (bar or icon) shows a tooltip with
  // its category name.
  const [activeRow, setActiveRow] = useState<string | null>(null);
  // Month/year picker opened by tapping the month title.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseInt(month.slice(0, 4), 10));

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
          category: t.categoryId
            ? (() => {
                const c = categoryById[t.categoryId];
                return c ? displayCategoryName(c) : '';
              })()
            : '',
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
      .map((tc) => {
        const cat = tc.categoryId ? categoryById[tc.categoryId] : undefined;
        return {
          key: tc.categoryId ?? 'none',
          color: cat?.color ?? palette.dim,
          icon: cat?.icon as string | undefined,
          name: cat ? displayCategoryName(cat) : t('history.noCategory'),
          minor: tc.totalMinor,
        };
      });
    const sumTop = segs.reduce((s, x) => s + x.minor, 0);
    const other = outcome - sumTop;
    if (other > 0)
      segs.push({
        key: 'other',
        color: palette.dim2,
        icon: undefined,
        name: t('history.other'),
        minor: other,
      });
    return segs;
  }, [topCategories, categoryById, outcome, palette, t]);

  // Auto-dismiss the segment tooltip after a beat.
  useEffect(() => {
    if (!activeSeg) return;
    const id = setTimeout(() => setActiveSeg(null), TOOLTIP_TIMEOUT);
    return () => clearTimeout(id);
  }, [activeSeg]);

  const clearTips = useCallback(() => {
    setActiveSeg(null);
    setActiveRow(null);
  }, []);

  // Month change clears any open tooltip (the bars belong to the old month).
  const goMonth = useCallback(
    (m: string) => {
      clearTips();
      setMonth(m);
    },
    [clearTips, setMonth],
  );

  // The list content vs. viewport heights — used to gate the collapse so it can
  // never enter a feedback loop when there is barely anything to scroll.
  const contentH = useRef(0);
  const viewportH = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Collapsing shrinks the fixed header, which grows the list viewport and
    // pulls the scroll offset back up — with little content that bounce would
    // flip the state forever. Only collapse when there is real room to scroll
    // (more than the height the category block reclaims); expanding is always
    // allowed so the user can restore it by scrolling back to the top.
    if (!collapsed) {
      const maxScroll = contentH.current - viewportH.current;
      if (maxScroll <= COLLAPSE_MIN_SCROLL) return;
      if (y > 56) {
        setCollapsed(true);
        clearTips();
      }
    } else if (y <= 24) {
      setCollapsed(false);
      clearTips();
    }
  };

  // Clamp navigation: no future months, and no earlier than the first data month.
  const currentMonth = monthPrefix(todayLocalDay());
  const canNext = month < currentMonth;
  const canPrev = earliestMonth ? month > earliestMonth : false;

  // Month/year picker bounds — same range as the arrows: [earliest data, now].
  const minMonth = earliestMonth ?? currentMonth;
  const minYear = parseInt(minMonth.slice(0, 4), 10);
  const maxYear = parseInt(currentMonth.slice(0, 4), 10);

  const openPicker = () => {
    setPickerYear(parseInt(month.slice(0, 4), 10));
    setPickerOpen(true);
    hapticLight();
  };
  const pickMonth = (value: string) => {
    goMonth(value);
    setPickerOpen(false);
    hapticLight();
  };

  const onRowPress = useCallback(
    (tx: Transaction) => {
      const sibling = tx.transferPairId ? transferToLeg.get(tx.transferPairId) : undefined;
      openTransactionDetail(tx, () => void HistoryController.loadMonth(month), sibling);
    },
    [month, transferToLeg],
  );

  // Pinned above the scrolling list (owner: month bar fixed on scroll).
  const MonthBar = (
    <View style={styles.monthBar}>
      <View style={styles.monthNav}>
        <GlassButton
          round
          onPress={() => {
            if (canPrev) goMonth(shiftMonth(month, -1));
          }}
          contentStyle={styles.navBtnContent}
          style={!canPrev && styles.navBtnDisabled}
          accessibilityLabel={t('history.prevMonth')}
        >
          <AppIcon name="chevron-back" color={canPrev ? palette.ink : palette.dim2} size={22} />
        </GlassButton>
        <Pressable
          onPress={openPicker}
          style={styles.monthTitleBtn}
          accessibilityRole="button"
          accessibilityLabel={t('history.pickMonthYear')}
        >
          <Text {...textProps('title')} style={styles.monthTitle}>
            {formatMonth(month)}
          </Text>
        </Pressable>
        <GlassButton
          round
          onPress={() => {
            if (canNext) goMonth(shiftMonth(month, 1));
          }}
          contentStyle={styles.navBtnContent}
          style={!canNext && styles.navBtnDisabled}
          accessibilityLabel={t('history.nextMonth')}
        >
          <AppIcon name="chevron-forward" color={canNext ? palette.ink : palette.dim2} size={22} />
        </GlassButton>
      </View>
    </View>
  );

  // Fixed above the scrolling list: month totals + category graphics. On scroll
  // the per-category bars collapse into one proportional segmented bar.
  const FixedStats = (
    <View style={styles.fixedStats}>
      <View style={styles.totals}>
        <Pressable
          style={styles.totalCard}
          onPress={() => {
            hapticLight();
            openWalletTotal({ flow: 'income', mode: 'byTx' });
          }}
          accessibilityRole="button"
        >
          <Text {...textProps('caption')} style={styles.totalLabel}>
            {t('history.income')}
          </Text>
          {firstLoad ? (
            <Skeleton height={18} style={styles.totalSkeleton} />
          ) : (
            <Money
              minor={income}
              currency={base}
              style={styles.totalPos}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
          )}
        </Pressable>
        <Pressable
          style={styles.totalCard}
          onPress={() => {
            hapticLight();
            openWalletTotal({ flow: 'expense', mode: 'byTx' });
          }}
          accessibilityRole="button"
        >
          <Text {...textProps('caption')} style={styles.totalLabel}>
            {t('history.outcome')}
          </Text>
          {firstLoad ? (
            <Skeleton height={18} style={styles.totalSkeleton} />
          ) : (
            <Money
              minor={outcome}
              currency={base}
              style={styles.totalNeg}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
          )}
        </Pressable>
        <Pressable
          style={styles.totalCard}
          onPress={() => {
            hapticLight();
            openWalletTotal({ flow: 'all', mode: 'byTx' });
          }}
          accessibilityRole="button"
        >
          <Text {...textProps('caption')} style={styles.totalLabel}>
            {t('history.difference')}
          </Text>
          {firstLoad ? (
            <Skeleton height={18} style={styles.totalSkeleton} />
          ) : (
            <Money
              minor={income - outcome}
              currency={base}
              options={{ showPlus: true }}
              style={[
                styles.totalDiff,
                { color: income - outcome >= 0 ? palette.pos : palette.neg },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
          )}
        </Pressable>
      </View>

      {outcome > 0 && catSegments.length > 0 && (
        <Animated.View layout={LinearTransition.duration(collapseDuration)} style={styles.topBlock}>
          {collapsed ? (
            <Animated.View
              key="seg"
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={styles.segWrap}
            >
              <View style={styles.segBar} onLayout={(e) => setSegBarW(e.nativeEvent.layout.width)}>
                {catSegments.map((s) => (
                  <Pressable
                    key={s.key}
                    onLayout={(e) => {
                      const { x, width } = e.nativeEvent.layout;
                      setSegLayouts((prev) =>
                        prev[s.key]?.x === x && prev[s.key]?.width === width
                          ? prev
                          : { ...prev, [s.key]: { x, width } },
                      );
                    }}
                    onPress={() => {
                      hapticLight();
                      // Reset the measured width so the tooltip re-centres on the
                      // new segment's content instead of flashing at a stale spot.
                      setTipW(0);
                      setActiveSeg((prev) => (prev === s.key ? null : s.key));
                    }}
                    style={{ flex: s.minor, backgroundColor: s.color }}
                  />
                ))}
              </View>
              {activeSeg &&
                (() => {
                  const seg = catSegments.find((s) => s.key === activeSeg);
                  const L = segLayouts[activeSeg];
                  if (!seg || !L) return null;
                  const centerX = L.x + L.width / 2;
                  // Centre the card on the segment, clamped inside the bar's width.
                  const left =
                    tipW > 0
                      ? Math.max(0, Math.min(centerX - tipW / 2, Math.max(0, segBarW - tipW)))
                      : centerX;
                  const caretLeft = Math.max(
                    TOOLTIP_CARET,
                    Math.min(centerX - left - TOOLTIP_CARET, Math.max(0, tipW - TOOLTIP_CARET * 3)),
                  );
                  return (
                    <View style={[styles.tooltipAbs, { left, opacity: tipW > 0 ? 1 : 0 }]}>
                      <View
                        style={styles.tipCard}
                        onLayout={(e) => setTipW(e.nativeEvent.layout.width)}
                      >
                        <View style={styles.tooltipRow}>
                          {seg.icon ? (
                            <AppIcon name={seg.icon} color={seg.color} size={14} />
                          ) : (
                            <View style={[styles.tipDot, { backgroundColor: seg.color }]} />
                          )}
                          <Text style={styles.tipName} numberOfLines={1}>
                            {seg.name}
                          </Text>
                          <Money minor={seg.minor} currency={base} style={styles.tipAmount} />
                        </View>
                      </View>
                      {/* Caret is a sibling of the card (not a padded child) so its
                          x is measured in the same box as `left` — no padding skew. */}
                      <View style={[styles.caretTriangle, styles.caretAbs, { left: caretLeft }]} />
                    </View>
                  );
                })()}
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
                const key = tc.categoryId ?? 'none';
                const showName = activeRow === key;
                return (
                  <Pressable
                    key={key}
                    style={styles.barRow}
                    onPress={() => {
                      hapticLight();
                      setActiveRow((prev) => (prev === key ? null : key));
                    }}
                  >
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
                    {showName && (
                      <View style={styles.rowTipWrap} pointerEvents="none">
                        <View style={[styles.tipCard, styles.rowTipCard]}>
                          <View style={styles.tooltipRow}>
                            <AppIcon name={cat?.icon} color={cat?.color ?? palette.dim} size={14} />
                            <Text style={styles.tipName} numberOfLines={1}>
                              {cat ? displayCategoryName(cat) : t('history.noCategory')}
                            </Text>
                          </View>
                        </View>
                        {/* Caret centred under the card by the wrap's alignItems. */}
                        <View style={styles.caretTriangle} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );

  const Header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('history.searchPlaceholder')}
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
            { id: 'all', label: t('history.filterAll') },
            { id: 'expense', label: t('history.filterExpense') },
            { id: 'income', label: t('history.filterIncome') },
            ...accounts.map((a) => ({ id: a.id, label: displayAccountName(a) })),
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
        {t('history.records')}
      </Text>
    </View>
  );

  const MonthPicker = (
    <Modal
      visible={pickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setPickerOpen(false)}
    >
      <Pressable style={styles.pickerScrim} onPress={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.pickerYearRow}>
            <Pressable
              disabled={pickerYear <= minYear}
              onPress={() => setPickerYear((y) => y - 1)}
              style={styles.navBtn}
            >
              <Text style={[styles.navArrow, pickerYear <= minYear && styles.navArrowDisabled]}>
                ‹
              </Text>
            </Pressable>
            <Text {...textProps('title')} style={styles.pickerYear}>
              {pickerYear}
            </Text>
            <Pressable
              disabled={pickerYear >= maxYear}
              onPress={() => setPickerYear((y) => y + 1)}
              style={styles.navBtn}
            >
              <Text style={[styles.navArrow, pickerYear >= maxYear && styles.navArrowDisabled]}>
                ›
              </Text>
            </Pressable>
          </View>
          <View style={styles.pickerGrid}>
            {monthsShort.map((label, i) => {
              const value = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
              const enabled = value >= minMonth && value <= currentMonth;
              const selected = value === month;
              return (
                <Pressable
                  key={value}
                  disabled={!enabled}
                  onPress={() => pickMonth(value)}
                  style={[styles.pickerCell, selected && styles.pickerCellActive]}
                >
                  <Text
                    style={[
                      styles.pickerCellText,
                      selected && styles.pickerCellTextActive,
                      !enabled && styles.pickerCellTextDisabled,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {MonthBar}
        {FixedStats}
        {/* Wrapped in a layout-animated view so, when the category block above
            collapses/expands, the list glides to its new position in sync with
            that block's LinearTransition instead of snapping (which read as the
            feed "jumping"). Same duration → the two move as one. */}
        <Animated.View style={styles.listWrap} layout={LinearTransition.duration(collapseDuration)}>
          <FlashList
            data={rows}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              viewportH.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={(_w, h) => {
              contentH.current = h;
            }}
            ListHeaderComponent={Header}
            ListEmptyComponent={
              firstLoad ? (
                <View style={styles.feedSkeleton}>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} height={48} radius={Radius.listRow} />
                  ))}
                </View>
              ) : (
                <Text {...textProps('footnote')} style={styles.empty}>
                  {t('history.emptyMonth')}
                </Text>
              )
            }
            keyExtractor={(row) => (row.type === 'header' ? `h:${row.day}` : `t:${row.tx.id}`)}
            getItemType={(row) => row.type}
            contentContainerStyle={{
              ...styles.listContent,
              paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md,
            }}
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
              const tx = item.tx;
              const cat = tx.categoryId ? categoryById[tx.categoryId] : undefined;
              const isTransfer = tx.kind === 'transfer';
              const accent = isTransfer ? palette.dim : (cat?.color ?? palette.ink);
              const iconName = isTransfer
                ? TRANSFER_ICON
                : (cat?.icon ??
                  (tx.amountMinor >= 0 ? INCOME_FALLBACK_ICON : EXPENSE_FALLBACK_ICON));
              const title = isTransfer
                ? t('history.transfer')
                : tx.note || (cat && displayCategoryName(cat)) || t('history.noCategory');
              return (
                <Pressable
                  style={[styles.row, { backgroundColor: hexToRgba(accent, 0.14) }]}
                  onPress={() => onRowPress(tx)}
                >
                  <View style={[styles.rowIconWrap, { backgroundColor: hexToRgba(accent, 0.2) }]}>
                    <AppIcon name={iconName} color={accent} size={18} />
                  </View>
                  <Text {...textProps('row')} style={styles.rowTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  {isTransfer ? (
                    (() => {
                      const toLeg = tx.transferPairId
                        ? transferToLeg.get(tx.transferPairId)
                        : undefined;
                      return (
                        <TransferAmount
                          fromMinorAbs={Math.abs(tx.amountMinor)}
                          fromCurrency={tx.currency}
                          toMinorAbs={Math.abs(toLeg?.amountMinor ?? tx.amountMinor)}
                          toCurrency={toLeg?.currency ?? tx.currency}
                        />
                      );
                    })()
                  ) : (
                    <Money
                      minor={tx.amountMinor}
                      currency={tx.currency}
                      options={{ showPlus: true }}
                      style={[
                        styles.rowAmount,
                        { color: tx.amountMinor >= 0 ? palette.pos : palette.ink },
                      ]}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </SafeAreaView>
      {MonthPicker}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    safe: { flex: 1 },
    listWrap: { flex: 1 },
    listContent: { paddingHorizontal: Spacing.screenPadding },
    monthBar: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      backgroundColor: p.canvasBase,
    },
    header: { gap: Spacing.md, paddingTop: Spacing.sm },
    fixedStats: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
      // Tight gap so the spend bar sits close under the income/outcome totals.
      gap: Spacing.sm,
      backgroundColor: p.canvasBase,
    },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    navBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    navArrow: { color: p.ink, fontSize: 28, fontWeight: '400' },
    navArrowDisabled: { color: p.dim2, opacity: 0.4 },
    // Month prev/next: same liquid-glass affordance as the Settings back button.
    navBtnContent: { width: 38, height: 38 },
    navBtnDisabled: { opacity: 0.5 },
    monthTitleBtn: { flexShrink: 1, alignItems: 'center' },
    monthTitle: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '700' },
    // Month/year picker (tap the month title).
    pickerScrim: {
      flex: 1,
      backgroundColor: p.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    pickerCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: p.sheetBg,
      borderRadius: Radius.hero,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      padding: Spacing.xl,
      gap: Spacing.lg,
    },
    pickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    pickerYear: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '700' },
    pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    pickerCell: {
      width: '30%',
      flexGrow: 1,
      paddingVertical: Spacing.md,
      borderRadius: Radius.card,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
      alignItems: 'center',
    },
    pickerCellActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    pickerCellText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    pickerCellTextActive: { color: p.btnInk },
    pickerCellTextDisabled: { color: p.dim2, opacity: 0.4 },
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
    totalSkeleton: { marginTop: 4 },
    feedSkeleton: { gap: Spacing.sm, paddingTop: Spacing.md },
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
    // Full-bleed scroller (mirrors the Home account chips): cancel the list's
    // screen padding so chips scroll to the real screen edge, but keep the
    // first/last chip inset via the content padding.
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
    // No top margin: the summary bar sits directly under the totals (the removed
    // "категории трат" heading previously added the gap).
    topBlock: { gap: Spacing.sm },
    barRows: { gap: Spacing.sm },
    // Relative wrapper so the tap tooltip can float above the segmented bar.
    segWrap: { position: 'relative' },
    segBar: {
      flexDirection: 'row',
      // Same thickness as an expanded category bar (barTrack) so the collapsed
      // summary line reads as the same object, just condensed.
      height: SEGBAR_H,
      borderRadius: Radius.pill,
      overflow: 'hidden',
      gap: 2,
      backgroundColor: p.glassLightBg,
    },
    // Shared floating-tooltip card (icon/dot + name [+ amount]) with a downward
    // caret. Used both over a collapsed-bar segment and over an expanded row.
    tipCard: {
      backgroundColor: p.sheetBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      shadowColor: p.ink,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    // Collapsed-bar tooltip: an unpadded wrapper placed above the bar (x set
    // inline). Holds the card + caret as siblings so the caret shares the card's
    // measurement box (no padding skew).
    tooltipAbs: {
      position: 'absolute',
      bottom: SEGBAR_H + TOOLTIP_CARET,
      alignItems: 'flex-start',
      maxWidth: '100%',
      zIndex: 20,
    },
    // Expanded-row tooltip: card + caret stacked and centred, sitting just above
    // the bar itself (the bar is vertically centred in the row, so anchor the
    // caret near the row's mid-line rather than above the whole row).
    rowTipWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: '50%',
      alignItems: 'center',
      paddingBottom: 2,
      zIndex: 30,
    },
    rowTipCard: { maxWidth: '90%' },
    tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    tipDot: { width: 12, height: 12, borderRadius: 6 },
    tipName: { color: p.ink, fontSize: Typography.footnote.fontSize, maxWidth: 180 },
    tipAmount: { ...numberTextStyle, color: p.dim, fontSize: Typography.footnote.fontSize },
    // Downward caret triangle (colour = card bg). Positioned absolutely under the
    // collapsed tooltip (with caretAbs + inline left) or in-flow under the
    // expanded row card (centred by the wrap).
    caretTriangle: {
      width: 0,
      height: 0,
      borderLeftWidth: TOOLTIP_CARET,
      borderRightWidth: TOOLTIP_CARET,
      borderTopWidth: TOOLTIP_CARET,
      borderLeftColor: hexToRgba(p.sheetBg, 0),
      borderRightColor: hexToRgba(p.sheetBg, 0),
      borderTopColor: p.sheetBg,
    },
    caretAbs: { position: 'absolute', bottom: -TOOLTIP_CARET },
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
    empty: { color: p.dim2, paddingVertical: Spacing.xxl, textAlign: 'center' },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
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
