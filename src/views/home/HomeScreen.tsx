import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@components/AppIcon';
import { openAccountSheet } from '@components/accountSheetRef';
import { DragSortList } from '@components/DragSortList';
import { openBudgetSheet } from '@components/budgetSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { openWalletTotal } from '@components/walletTotalRef';
import { Money } from '@components/Money';
import { NegativeBalanceWarning } from '@components/NegativeBalanceWarning';
import { TransferAmount } from '@components/TransferAmount';
import { openTransactionDetail } from '@components/transactionDetailRef';
import { TransactionsController } from '@controllers/transactions.controller';
import { EXPENSE_FALLBACK_ICON, INCOME_FALLBACK_ICON, TRANSFER_ICON } from '@constants/icons';
import { usePalette } from '@hooks/usePalette';
import type { Transaction } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, textProps, Typography } from '@theme';
import { formatTodayCompact, todayLocalDay } from '@utils/date';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { hexToRgba } from '@utils/color';
import { hapticLight } from '@utils/haptics';
import { convertToBase, formatMoney, formatMoneyCompact } from '@utils/money';
import { computeAllowance, totalBalanceBaseMinor } from '@utils/summary';

/** Shared font size for the top-row date and wallet-total cards (same type). */
const TOP_ROW_FONT_SIZE = 14;

/** Shared duration for the header collapse/expand layout animation. */
const COLLAPSE_DURATION = 220;

/**
 * Minimum overscrollable distance (content − viewport, px) before the header is
 * allowed to collapse. Must exceed the height the hero + account chips reclaim,
 * or collapsing would grow the feed viewport enough to bounce the offset back up
 * and re-expand — a flip-flop loop (same guard as the History screen).
 */
const COLLAPSE_MIN_SCROLL = 180;

/** Feed rows are revealed a page at a time as you scroll (lazy loading). */
const FEED_PAGE = 25;
/** Distance from the feed's end (px) at which the next page is revealed. */
const FEED_LOAD_AHEAD = 500;

/** Net change of a day in base minor units (transfers excluded — internal moves). */
function dayNetBaseMinor(txs: Transaction[]): number {
  let net = 0;
  for (const t of txs) {
    if (t.kind === 'transfer') continue;
    net += convertToBase(t.amountMinor, t.rateToBaseE6);
  }
  return net;
}

/**
 * Home — block layout on the Liquid Glass plane. A wide hero block holds the
 * "можно сегодня" number with the carry-over "запас" bottom-right (B10); below,
 * account blocks and a day-grouped feed of cards. "+" opens the input sheet.
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const rates = useDataStore((s) => s.rates);
  const recent = useDataStore((s) => s.recent);
  const categories = useDataStore((s) => s.categories);
  const base = useSettingsStore((s) => s.baseCurrency);
  const budgetPlan = useSettingsStore((s) => s.budgetPlan);

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  // Destination leg of each transfer (the positive, to-account row), keyed by
  // pair id, so a shown from-leg can display "source → destination".
  const transferToLeg = useMemo(() => {
    const m = new Map<string, Transaction>();
    for (const t of recent) {
      if (t.kind === 'transfer' && t.amountMinor > 0 && t.transferPairId) {
        m.set(t.transferPairId, t);
      }
    }
    return m;
  }, [recent]);

  // Collapse the hero + account chips into single-line rows once the feed
  // scrolls (mirrors the History screen). Gated on real scrollable room so it
  // can never flip-flop when there is barely anything to scroll.
  const [collapsed, setCollapsed] = useState(false);
  // Freeze the chips scroller while an account chip is being dragged.
  const [chipsDragging, setChipsDragging] = useState(false);
  // Lazy loading: how many recent entries the feed currently renders. Grows a
  // page at a time as you scroll, so a long history never mounts all at once.
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE);
  const contentH = useRef(0);
  const viewportH = useRef(0);
  const recentLen = recent.length;

  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // Reveal the next page as the feed nears its end.
      if (contentH.current - viewportH.current - y < FEED_LOAD_AHEAD) {
        setVisibleCount((c) => (c < recentLen ? c + FEED_PAGE : c));
      }
      if (!collapsed) {
        const maxScroll = contentH.current - viewportH.current;
        if (maxScroll <= COLLAPSE_MIN_SCROLL) return;
        if (y > 56) setCollapsed(true);
      } else if (y <= 24) {
        setCollapsed(false);
      }
    },
    [collapsed, recentLen],
  );

  const { perDayMinor, todaySpent, carry, heroColor, configured, shortfallMinor, totalMinor } =
    useMemo(() => {
      const {
        perDayMinor: budget,
        todaySpentMinor: spent,
        carryMinor,
        configured: isConfigured,
        periodBudgetMinor,
        periodSpentMinor,
      } = computeAllowance({
        plan: budgetPlan,
        recent,
        base,
        rates,
        todayLocalDay: todayLocalDay(),
        now: new Date(),
      });
      const usage = budget > 0 ? spent / budget : spent > 0 ? 1 : 0;
      const color = usage < 0.8 ? palette.pos : usage < 1 ? palette.warn : palette.neg;
      // "Денег может не хватить": what's still planned to be spent this period vs.
      // how much money actually exists across all accounts (converted to base).
      const remainingPlan = Math.max(0, periodBudgetMinor - periodSpentMinor);
      const available = totalBalanceBaseMinor(accounts, balances, rates, base);
      // The "запас" is how far ahead of pace you are — but you can't carry more
      // than the money you actually own, so cap a positive surplus at the total
      // balance (a deficit stays as is, it's a warning).
      const carryShown = carryMinor > 0 ? Math.min(carryMinor, Math.max(0, available)) : carryMinor;
      return {
        perDayMinor: budget,
        todaySpent: spent,
        carry: carryShown,
        heroColor: color,
        configured: isConfigured,
        shortfallMinor: isConfigured ? remainingPlan - available : 0,
        totalMinor: available,
      };
    }, [budgetPlan, recent, base, rates, accounts, balances, palette]);

  const insufficientFunds = configured && shortfallMinor > 0;

  // The wallet-total drives how tightly the date is packed, but only genuinely
  // huge sums steal enough room to matter: full date under a million, drop the
  // month name in the millions, drop the weekday too in the billions+.
  const totalMajorAbs = Math.abs(totalMinor) / 100;
  const dateTier: 0 | 1 | 2 = totalMajorAbs < 1_000_000 ? 0 : totalMajorAbs < 1_000_000_000 ? 1 : 2;

  const onWarningPress = useCallback(() => {
    hapticLight();
    Alert.alert(
      t('home.insufficientTitle'),
      t('home.insufficientBody', {
        period: t(budgetPlan.period === 'week' ? 'home.periodWeek' : 'home.periodMonth'),
        amount: formatMoney(Math.max(0, shortfallMinor), base),
      }),
      [{ text: t('common.ok') }],
    );
  }, [budgetPlan.period, shortfallMinor, base, t]);

  const days = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of recent.slice(0, visibleCount)) {
      // A transfer is two linked rows; show it once (the source/negative leg).
      if (t.kind === 'transfer' && t.amountMinor > 0) continue;
      const arr = map.get(t.localDay) ?? [];
      arr.push(t);
      map.set(t.localDay, arr);
    }
    return [...map.entries()];
  }, [recent, visibleCount]);

  // Tapping the hero opens the budget-plan sheet in place (staying on Home).
  const onHeroPress = useCallback(() => {
    hapticLight();
    openBudgetSheet();
  }, []);

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Fixed top: info card + hero + accounts (only the feed scrolls). Layout-
            animated so the hero/chips collapse glides and the feed follows. */}
        <Animated.View
          style={styles.fixedTop}
          layout={LinearTransition.duration(COLLAPSE_DURATION)}
        >
          {/* Top row: today (left) + wallet total (right, tappable) */}
          <View style={styles.topRow}>
            <View style={styles.todayCard}>
              <Text
                {...textProps('caption')}
                style={styles.todayLine}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {formatTodayCompact(dateTier)}
              </Text>
            </View>
            <Pressable
              style={styles.totalCard}
              onPress={() => {
                hapticLight();
                openWalletTotal();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('home.totalA11y')}
            >
              <AppIcon name="stats-chart" color={palette.dim} size={16} />
              <Money
                minor={totalMinor}
                currency={base}
                compact
                style={styles.totalValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              />
            </Pressable>
          </View>

          {/* Hero block — collapses to a single line (сумма слева · потрачено
              справа) once the feed scrolls. */}
          <Pressable onPress={onHeroPress} accessibilityRole="button">
            <Animated.View
              style={[styles.hero, collapsed && styles.heroCollapsed]}
              layout={LinearTransition.duration(COLLAPSE_DURATION)}
            >
              {collapsed ? (
                <Animated.View
                  key="hero-min"
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(120)}
                  style={styles.heroCompactRow}
                >
                  <View style={styles.heroCompactLeft}>
                    {configured ? (
                      <Money
                        minor={perDayMinor}
                        currency={base}
                        compact
                        style={[styles.heroCompactNumber, { color: heroColor }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      />
                    ) : (
                      <Text style={[styles.heroCompactNumber, { color: palette.dim }]}>—</Text>
                    )}
                    {insufficientFunds && (
                      <Pressable
                        onPress={onWarningPress}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.insufficientA11y')}
                      >
                        <AppIcon name="warning" color={palette.warn} size={16} />
                      </Pressable>
                    )}
                  </View>
                  {configured ? (
                    <Text
                      {...textProps('footnote')}
                      style={styles.heroSpent}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      {t('home.spent')} {formatMoneyCompact(todaySpent, base, { hideCode: true })}{' '}
                      {base}
                    </Text>
                  ) : (
                    <Text {...textProps('footnote')} style={styles.heroSpent}>
                      {t('home.setPlanShort')}
                    </Text>
                  )}
                </Animated.View>
              ) : (
                <Animated.View
                  key="hero-full"
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(120)}
                >
                  <View style={styles.heroLabelRow}>
                    <Text {...textProps('micro')} style={styles.heroLabel}>
                      {t('home.allowanceLabel')}
                    </Text>
                    {insufficientFunds && (
                      <Pressable
                        onPress={onWarningPress}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('home.insufficientA11y')}
                      >
                        <AppIcon name="warning" color={palette.warn} size={16} />
                      </Pressable>
                    )}
                  </View>
                  {configured ? (
                    <Money
                      minor={perDayMinor}
                      currency={base}
                      compact
                      options={{ hideCode: true }}
                      style={[styles.heroNumber, { color: heroColor }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    />
                  ) : (
                    <Text style={[styles.heroNumber, { color: palette.dim }]}>—</Text>
                  )}
                  <View style={styles.heroFooter}>
                    {configured ? (
                      <Text
                        {...textProps('footnote')}
                        style={styles.heroSpent}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {t('home.spent')} {formatMoneyCompact(todaySpent, base, { hideCode: true })}{' '}
                        {base}
                      </Text>
                    ) : (
                      <Text {...textProps('footnote')} style={styles.heroSpent}>
                        {t('home.setPlan')}
                      </Text>
                    )}
                    {configured && carry !== 0 && (
                      <View
                        style={[
                          styles.carry,
                          { borderColor: carry > 0 ? palette.pos : palette.neg },
                        ]}
                      >
                        <Money
                          minor={carry}
                          currency={base}
                          compact
                          options={{ showPlus: true, hideCode: true }}
                          style={[
                            styles.carryText,
                            { color: carry > 0 ? palette.pos : palette.neg },
                          ]}
                        />
                        <Text
                          style={[
                            styles.carryLabel,
                            { color: carry > 0 ? palette.pos : palette.neg },
                          ]}
                        >
                          {t('home.carry')}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </Pressable>

          {/* Account blocks — horizontal scroll (frozen mid-drag), add at the end.
              Long-press a chip to reorder; a quick tap still opens its sheet. */}
          <ScrollView
            horizontal
            scrollEnabled={!chipsDragging}
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            <DragSortList
              horizontal
              gap={Spacing.sm}
              data={accounts}
              keyExtractor={(a) => a.id}
              onReorder={(ids) => void TransactionsController.reorderAccounts(ids)}
              onDragStateChange={setChipsDragging}
              liftShadowColor={palette.ink}
              footer={
                <Pressable style={styles.addChip} onPress={() => openAccountSheet()}>
                  <Text style={styles.addChipText}>{t('home.addAccount')}</Text>
                </Pressable>
              }
              renderItem={(a) => (
                <Pressable
                  style={[styles.accountChip, collapsed && styles.accountChipCollapsed]}
                  onPress={() => openAccountSheet(a.id)}
                >
                  {collapsed ? (
                    // Collapsed: one line — icon left, balance right.
                    <View style={styles.chipCompactRow}>
                      <AppIcon
                        name={a.icon}
                        color={palette.dim}
                        size={16}
                        fallback="wallet-outline"
                      />
                      <Money
                        minor={balances[a.id] ?? 0}
                        currency={a.currency}
                        style={styles.accountBalanceCompact}
                        numberOfLines={1}
                      />
                      {(balances[a.id] ?? 0) < 0 && (
                        <NegativeBalanceWarning accountName={displayAccountName(a)} size={14} />
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={styles.accountNameRow}>
                        <AppIcon
                          name={a.icon}
                          color={palette.dim}
                          size={14}
                          fallback="wallet-outline"
                        />
                        <Text
                          {...textProps('caption')}
                          style={styles.accountName}
                          numberOfLines={1}
                        >
                          {displayAccountName(a)}
                        </Text>
                        {(balances[a.id] ?? 0) < 0 && (
                          <NegativeBalanceWarning accountName={displayAccountName(a)} size={14} />
                        )}
                      </View>
                      <Money
                        minor={balances[a.id] ?? 0}
                        currency={a.currency}
                        style={styles.accountBalance}
                      />
                    </>
                  )}
                </Pressable>
              )}
            />
          </ScrollView>
        </Animated.View>

        {/* Feed — floating day labels; each entry is its own category-tinted card.
            Wrapped in a layout-animated view so it glides up/down in sync with the
            header collapse instead of snapping. */}
        <Animated.View
          style={styles.feedWrap}
          layout={LinearTransition.duration(COLLAPSE_DURATION)}
        >
          <ScrollView
            style={styles.feedScroll}
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            onScroll={onFeedScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              viewportH.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={(_w, h) => {
              contentH.current = h;
            }}
          >
            {recent.length === 0 ? (
              <Text {...textProps('footnote')} style={styles.empty}>
                {t('home.empty')}
              </Text>
            ) : (
              days.map(([day, txs]) => (
                <View key={day} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text {...textProps('caption')} style={styles.dayLabel}>
                      {day}
                    </Text>
                    <Money
                      minor={dayNetBaseMinor(txs)}
                      currency={base}
                      options={{ showPlus: true }}
                      style={styles.dayTotal}
                    />
                  </View>
                  {txs.map((tx) => {
                    const cat = tx.categoryId ? categoryById[tx.categoryId] : undefined;
                    const isTransfer = tx.kind === 'transfer';
                    const accent = isTransfer ? palette.dim : (cat?.color ?? palette.ink);
                    const iconName = isTransfer
                      ? TRANSFER_ICON
                      : (cat?.icon ??
                        (tx.amountMinor >= 0 ? INCOME_FALLBACK_ICON : EXPENSE_FALLBACK_ICON));
                    const title = isTransfer
                      ? t('home.transfer')
                      : tx.note || (cat && displayCategoryName(cat)) || t('home.noCategory');
                    const toLeg = tx.transferPairId
                      ? transferToLeg.get(tx.transferPairId)
                      : undefined;
                    return (
                      <Pressable
                        key={tx.id}
                        onPress={() => openTransactionDetail(tx, undefined, toLeg)}
                        style={[styles.txRow, { backgroundColor: hexToRgba(accent, 0.14) }]}
                      >
                        <View
                          style={[styles.txIconWrap, { backgroundColor: hexToRgba(accent, 0.2) }]}
                        >
                          <AppIcon name={iconName} color={accent} size={18} />
                        </View>
                        <Text {...textProps('row')} style={styles.rowTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        {isTransfer ? (
                          <TransferAmount
                            fromMinorAbs={Math.abs(tx.amountMinor)}
                            fromCurrency={tx.currency}
                            toMinorAbs={Math.abs(toLeg?.amountMinor ?? tx.amountMinor)}
                            toCurrency={toLeg?.currency ?? tx.currency}
                          />
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
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 78 }]}
        hitSlop={12}
        onPress={() => {
          hapticLight();
          openInputSheet();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('home.addEntryA11y')}
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    safe: { flex: 1 },
    fixedTop: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.xl,
      gap: Spacing.lg,
    },
    feedWrap: { flex: 1 },
    feedScroll: { flex: 1 },
    feedContent: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.lg,
      paddingBottom: 170,
      gap: Spacing.cardGap,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      // Both cards share the row height (the taller one wins); the total card
      // reads slightly larger via its bigger number.
      alignItems: 'stretch',
      gap: Spacing.sm,
    },
    todayCard: {
      flexShrink: 1,
      justifyContent: 'center',
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    todayLine: { color: p.dim, textTransform: 'capitalize', fontSize: TOP_ROW_FONT_SIZE },
    totalCard: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      maxWidth: '58%',
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    totalValue: {
      ...numberTextStyle,
      color: p.dim,
      flexShrink: 1,
      fontSize: TOP_ROW_FONT_SIZE,
    },
    // Hero
    heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    hero: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.hero,
      padding: Spacing.xl,
      gap: Spacing.sm,
      shadowColor: p.ink,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    // Collapsed hero — one line, tighter vertical padding.
    heroCollapsed: { paddingVertical: Spacing.md },
    heroCompactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    heroCompactLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    heroCompactNumber: {
      ...numberTextStyle,
      fontSize: Typography.title.fontSize,
      fontWeight: '700',
    },
    heroLabel: { color: p.dim, letterSpacing: Typography.micro.letterSpacing },
    heroNumber: {
      ...numberTextStyle,
      fontSize: Typography.hero.fontSize,
      fontWeight: Typography.hero.fontWeight,
      letterSpacing: Typography.hero.letterSpacing,
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: Spacing.xs,
    },
    heroSpent: { color: p.dim, flexShrink: 1, marginRight: Spacing.sm },
    carry: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: 3,
      borderRadius: Radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
    },
    carryText: { fontSize: Typography.footnote.fontSize },
    carryLabel: { fontSize: Typography.caption.fontSize },
    // Accounts — full-bleed scroller: cancel the parent's screen padding so chips
    // scroll to the real screen edge, but keep the first/last chip inset via the
    // content padding.
    chipsScroll: { marginHorizontal: -Spacing.screenPadding },
    chipsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.screenPadding,
      paddingBottom: Spacing.sm,
    },
    accountChip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.card,
      backgroundColor: p.glassBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      gap: 2,
      minWidth: 120,
    },
    // Collapsed chip — one line (icon left, balance right), no name.
    accountChipCollapsed: {
      paddingVertical: Spacing.sm,
      minWidth: 0,
    },
    chipCompactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    accountBalanceCompact: { color: p.ink, fontSize: Typography.body.fontSize },
    accountNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    accountName: { color: p.dim, flexShrink: 1 },
    accountBalance: { color: p.ink, fontSize: Typography.headline.fontSize },
    addChip: {
      paddingHorizontal: Spacing.lg,
      justifyContent: 'center',
      borderRadius: Radius.card,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    addChipText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    // Feed — floating day label + per-entry tinted cards
    empty: { color: p.dim2, textAlign: 'center', paddingVertical: Spacing.lg },
    dayGroup: { gap: Spacing.cardGap },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.xs,
      paddingBottom: 2,
    },
    dayLabel: { color: p.dim2 },
    dayTotal: { color: p.dim, fontSize: Typography.caption.fontSize },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.card,
    },
    txIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: p.ink, flex: 1 },
    rowAmount: { fontSize: Typography.row.fontSize },
    // FAB
    fab: {
      position: 'absolute',
      right: Spacing.screenPadding,
      zIndex: 10,
      width: 60,
      height: 60,
      borderRadius: Radius.pill,
      backgroundColor: p.btnBg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: p.ink,
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    fabPlus: { color: p.btnInk, fontSize: 32, lineHeight: 36, fontWeight: '300' },
  });
