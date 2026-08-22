import { useCallback, useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppIcon } from '@components/AppIcon';
import { openAccountSheet } from '@components/accountSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { openWalletTotal } from '@components/walletTotalRef';
import { Money } from '@components/Money';
import { openTransactionDetail } from '@components/transactionDetailRef';
import { EXPENSE_FALLBACK_ICON, INCOME_FALLBACK_ICON, TRANSFER_ICON } from '@constants/icons';
import { usePalette } from '@hooks/usePalette';
import type { Transaction } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, textProps, Typography } from '@theme';
import { formatTodayHuman, todayLocalDay } from '@utils/date';
import { hexToRgba } from '@utils/color';
import { hapticLight } from '@utils/haptics';
import { convertToBase, formatMoney } from '@utils/money';
import { periodLabel } from '@utils/budget';
import { computeAllowance, totalBalanceBaseMinor } from '@utils/summary';

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
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const router = useRouter();

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

  const { perDayMinor, todaySpent, carry, heroColor, configured, shortfallMinor, totalMinor } =
    useMemo(() => {
      const {
        perDayMinor: budget,
        todaySpentMinor: spent,
        carryMinor,
        configured: isConfigured,
        expectedBaseMinor,
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
      const remainingPlan = Math.max(0, expectedBaseMinor - periodSpentMinor);
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

  const onWarningPress = useCallback(() => {
    hapticLight();
    Alert.alert(
      'Денег может не хватить',
      `На ${periodLabel(budgetPlan.period)} по плану осталось потратить ` +
        `${formatMoney(Math.max(0, shortfallMinor), base)} сверх того, что есть на счетах. ` +
        'Возможно, стоит уменьшить план бюджета или пополнить счёт.',
      [{ text: 'Понятно' }],
    );
  }, [budgetPlan.period, shortfallMinor, base]);

  const days = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of recent.slice(0, 80)) {
      // A transfer is two linked rows; show it once (the source/negative leg).
      if (t.kind === 'transfer' && t.amountMinor > 0) continue;
      const arr = map.get(t.localDay) ?? [];
      arr.push(t);
      map.set(t.localDay, arr);
    }
    return [...map.entries()];
  }, [recent]);

  // Tapping the hero opens the budget-plan settings.
  const onHeroPress = useCallback(() => {
    hapticLight();
    router.push('/(tabs)/(settings)/money' as never);
  }, [router]);

  return (
    <View style={styles.canvas}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Fixed top: info card + hero + accounts (only the feed scrolls) */}
        <View style={styles.fixedTop}>
          {/* Top row: today (left) + wallet total (right, tappable) */}
          <View style={styles.topRow}>
            <View style={styles.todayCard}>
              <Text {...textProps('caption')} style={styles.todayLine}>
                {formatTodayHuman()}
              </Text>
            </View>
            <Pressable
              style={styles.totalCard}
              onPress={() => {
                hapticLight();
                openWalletTotal();
              }}
              accessibilityRole="button"
              accessibilityLabel="Всего денег и график баланса"
            >
              <AppIcon name="stats-chart" color={palette.dim} size={16} />
              <Money
                minor={totalMinor}
                currency={base}
                style={styles.totalValue}
                numberOfLines={1}
              />
            </Pressable>
          </View>

          {/* Hero block */}
          <Pressable onPress={onHeroPress} style={styles.hero} accessibilityRole="button">
            <View style={styles.heroLabelRow}>
              <Text {...textProps('micro')} style={styles.heroLabel}>
                МОЖНО СЕГОДНЯ
              </Text>
              {insufficientFunds && (
                <Pressable
                  onPress={onWarningPress}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Денег может не хватить на план"
                >
                  <AppIcon name="warning" color={palette.warn} size={16} />
                </Pressable>
              )}
            </View>
            {configured ? (
              <Money
                minor={perDayMinor}
                currency={base}
                options={{ hideCode: true }}
                style={[styles.heroNumber, { color: heroColor }]}
              />
            ) : (
              <Text style={[styles.heroNumber, { color: palette.dim }]}>—</Text>
            )}
            <View style={styles.heroFooter}>
              {configured ? (
                <Text {...textProps('footnote')} style={styles.heroSpent}>
                  потрачено {formatMoney(todaySpent, base, { hideCode: true })} {base}
                </Text>
              ) : (
                <Text {...textProps('footnote')} style={styles.heroSpent}>
                  Задайте план бюджета →
                </Text>
              )}
              {configured && carry !== 0 && (
                <View
                  style={[styles.carry, { borderColor: carry > 0 ? palette.pos : palette.neg }]}
                >
                  <Money
                    minor={carry}
                    currency={base}
                    options={{ showPlus: true, hideCode: true }}
                    style={[styles.carryText, { color: carry > 0 ? palette.pos : palette.neg }]}
                  />
                  <Text
                    style={[styles.carryLabel, { color: carry > 0 ? palette.pos : palette.neg }]}
                  >
                    запас
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Account blocks — horizontal scroll, add button at the end */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                style={styles.accountChip}
                onPress={() => openAccountSheet(a.id)}
              >
                <View style={styles.accountNameRow}>
                  <AppIcon name={a.icon} color={palette.dim} size={14} fallback="wallet-outline" />
                  <Text {...textProps('caption')} style={styles.accountName} numberOfLines={1}>
                    {a.name}
                  </Text>
                </View>
                <Money
                  minor={balances[a.id] ?? 0}
                  currency={a.currency}
                  style={styles.accountBalance}
                />
              </Pressable>
            ))}
            <Pressable style={styles.addChip} onPress={() => openAccountSheet()}>
              <Text style={styles.addChipText}>＋ Счёт</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Feed — floating day labels; each entry is its own category-tinted card */}
        <ScrollView
          style={styles.feedScroll}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {recent.length === 0 ? (
            <Text {...textProps('footnote')} style={styles.empty}>
              Пока пусто. Нажмите + и запишите первую трату.
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
                {txs.map((t) => {
                  const cat = t.categoryId ? categoryById[t.categoryId] : undefined;
                  const isTransfer = t.kind === 'transfer';
                  const accent = isTransfer ? palette.dim : (cat?.color ?? palette.ink);
                  const iconName = isTransfer
                    ? TRANSFER_ICON
                    : (cat?.icon ??
                      (t.amountMinor >= 0 ? INCOME_FALLBACK_ICON : EXPENSE_FALLBACK_ICON));
                  const title = isTransfer ? 'Перевод' : t.note || cat?.name || 'Без категории';
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => openTransactionDetail(t)}
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
                })}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 78 }]}
        hitSlop={12}
        onPress={() => {
          hapticLight();
          openInputSheet();
        }}
        accessibilityRole="button"
        accessibilityLabel="Добавить запись"
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
      alignItems: 'center',
      gap: Spacing.sm,
    },
    todayCard: {
      justifyContent: 'center',
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    todayLine: { color: p.dim, textTransform: 'capitalize' },
    totalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    totalValue: { ...numberTextStyle, color: p.dim, fontSize: Typography.headline.fontSize },
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
    heroSpent: { color: p.dim },
    carry: {
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
    // Accounts
    chipsRow: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.sm },
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
