import { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useShallow } from 'zustand/react/shallow';

import { AppIcon } from '@components/AppIcon';
import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { goalsSheetRef, type GoalsSheetHandle } from '@components/goalsSheetRef';
import { openInputSheet } from '@components/inputSheetRef';
import { Money } from '@components/Money';
import { ProgressRing } from '@components/ProgressRing';
import { CATEGORY_COLOR_CHOICES } from '@constants/categories';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { Account } from '@models';
import { selectGoals, selectSpendAccounts, useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayAccountName } from '@utils/displayName';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import {
  amountPlaceholder,
  minorToAmountInput,
  parseAmountToMinor,
  sanitizeAmountInput,
} from '@utils/money';

type GoalsView = 'list' | 'form';

/**
 * The single global savings-goals sheet (rendered once at the app root). Lists
 * goals with progress rings and hosts the create/edit form, the top-up flow
 * (a transfer from a spend account) and closing a goal. Opened from the Home
 * goal-rings row via {@link openGoalsSheet}.
 */
export function GoalsSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sheetRef = useRef<BottomSheetModal>(null);

  const goals = useDataStore(useShallow(selectGoals));
  const spendAccounts = useDataStore(useShallow(selectSpendAccounts));
  const balances = useDataStore((s) => s.balances);
  const base = useSettingsStore((s) => s.baseCurrency);

  const [view, setView] = useState<GoalsView>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields (create/edit).
  const [name, setName] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [currency, setCurrency] = useState(base);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_CHOICES[0] as string);

  useImperativeHandle(
    goalsSheetRef,
    (): GoalsSheetHandle => ({
      open() {
        setView('list');
        sheetRef.current?.present();
      },
    }),
    [],
  );

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setTargetInput('');
    setCurrency(base);
    setColor(CATEGORY_COLOR_CHOICES[0] as string);
    setView('form');
    hapticLight();
  };

  const openEdit = (g: Account) => {
    setEditingId(g.id);
    setName(displayAccountName(g));
    setTargetInput(g.targetMinor ? minorToAmountInput(g.targetMinor, g.currency) : '');
    setCurrency(g.currency);
    setColor(g.color ?? (CATEGORY_COLOR_CHOICES[0] as string));
    setView('form');
    hapticLight();
  };

  // "Add money" opens the shared transaction sheet in transfer mode, preset to
  // move from a spend account into this goal — a single entry point for adding
  // funds instead of a separate in-sheet top-up screen.
  const openTopup = (g: Account) => {
    hapticLight();
    sheetRef.current?.dismiss();
    openInputSheet({
      kind: 'transfer',
      fromAccountId: spendAccounts[0]?.id,
      toAccountId: g.id,
    });
  };

  const saveGoal = async () => {
    const resolvedName = name.trim();
    const targetMinor = parseAmountToMinor(targetInput, currency) ?? 0;
    if (!resolvedName || targetMinor <= 0) return;
    if (editingId) {
      await TransactionsController.updateGoal(editingId, {
        name: resolvedName,
        targetMinor,
        color,
      });
    } else {
      await TransactionsController.createGoal({
        name: resolvedName,
        currency,
        targetMinor,
        color,
      });
    }
    hapticSuccess();
    setView('list');
  };

  const askClose = (g: Account) => {
    Alert.alert(t('goals.closeTitle'), t('goals.closeBody', { name: displayAccountName(g) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('goals.closeConfirm'),
        style: 'destructive',
        onPress: async () => {
          await TransactionsController.closeGoal(g.id);
          hapticSuccess();
        },
      },
    ]);
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['70%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {view === 'list' && (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t('goals.title')}</Text>
              <Pressable style={styles.addBtn} onPress={openCreate}>
                <AppIcon name="add" color={palette.btnInk} size={18} />
                <Text style={styles.addBtnText}>{t('goals.newGoal')}</Text>
              </Pressable>
            </View>

            {goals.length === 0 ? (
              <Text style={styles.empty}>{t('goals.empty')}</Text>
            ) : (
              goals.map((g) => {
                const saved = balances[g.id] ?? 0;
                const target = g.targetMinor ?? 0;
                const progress = target > 0 ? saved / target : 0;
                const ringColor = g.color ?? palette.accent;
                const reached = target > 0 && saved >= target;
                return (
                  <View key={g.id} style={styles.goalCard}>
                    <View style={styles.goalHead}>
                      <ProgressRing
                        size={52}
                        stroke={6}
                        progress={progress}
                        color={ringColor}
                        trackColor={hexToRgba(ringColor, 0.18)}
                      >
                        <Text style={[styles.goalPct, { color: ringColor }]}>
                          {Math.round(Math.min(1, progress) * 100)}
                        </Text>
                      </ProgressRing>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalName} numberOfLines={1}>
                          {displayAccountName(g)}
                        </Text>
                        <View style={styles.goalAmounts}>
                          <Money minor={saved} currency={g.currency} style={styles.goalSaved} />
                          <Text style={styles.goalOf}> {t('goals.of')} </Text>
                          <Money minor={target} currency={g.currency} style={styles.goalTarget} />
                        </View>
                      </View>
                    </View>
                    <View style={styles.goalActions}>
                      <Pressable style={styles.action} onPress={() => openTopup(g)}>
                        <AppIcon name="add-circle-outline" color={palette.accent} size={16} />
                        <Text style={styles.actionText}>{t('goals.topUp')}</Text>
                      </Pressable>
                      <Pressable style={styles.action} onPress={() => openEdit(g)}>
                        <AppIcon name="create-outline" color={palette.dim} size={16} />
                        <Text style={[styles.actionText, { color: palette.dim }]}>
                          {t('goals.edit')}
                        </Text>
                      </Pressable>
                      <Pressable style={styles.action} onPress={() => askClose(g)}>
                        <AppIcon
                          name={reached ? 'checkmark-circle-outline' : 'flag-outline'}
                          color={palette.neg}
                          size={16}
                        />
                        <Text style={[styles.actionText, { color: palette.neg }]}>
                          {t('goals.close')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            <Text style={styles.hint}>{t('goals.hint')}</Text>
          </>
        )}

        {view === 'form' && (
          <>
            <Text style={styles.title}>
              {editingId ? t('goals.editTitle') : t('goals.newGoal')}
            </Text>
            <Text style={styles.fieldLabel}>{t('goals.name')}</Text>
            <BottomSheetTextInput
              value={name}
              onChangeText={setName}
              placeholder={t('goals.namePlaceholder')}
              placeholderTextColor={palette.dim2}
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>{t('goals.target')}</Text>
            <View style={styles.amountRow}>
              <BottomSheetTextInput
                value={targetInput}
                onChangeText={(v) => setTargetInput(sanitizeAmountInput(v, currency))}
                placeholder={amountPlaceholder(currency)}
                placeholderTextColor={palette.dim2}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amountInput]}
              />
              {!editingId && <CurrencyDropdown value={currency} onChange={setCurrency} />}
            </View>
            <Text style={styles.fieldLabel}>{t('goals.color')}</Text>
            <View style={styles.swatches}>
              {CATEGORY_COLOR_CHOICES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && styles.swatchActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.formActions}>
              <Pressable style={styles.secondary} onPress={() => setView('list')}>
                <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={saveGoal}>
                <Text style={styles.primaryText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </>
        )}
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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    title: { color: p.ink, fontSize: Typography.headline.fontSize, fontWeight: '700' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: p.btnBg,
      borderRadius: Radius.pill,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    addBtnText: { color: p.btnInk, fontSize: Typography.footnote.fontSize, fontWeight: '600' },
    empty: { color: p.dim2, fontSize: Typography.body.fontSize, paddingVertical: Spacing.lg },
    goalCard: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    goalHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    goalPct: { ...numberTextStyle, fontSize: Typography.footnote.fontSize, fontWeight: '700' },
    goalInfo: { flex: 1, gap: 2 },
    goalName: { color: p.ink, fontSize: Typography.body.fontSize, fontWeight: '600' },
    goalAmounts: { flexDirection: 'row', alignItems: 'baseline' },
    goalSaved: { color: p.ink, fontSize: Typography.body.fontSize },
    goalOf: { color: p.dim2, fontSize: Typography.footnote.fontSize },
    goalTarget: { color: p.dim, fontSize: Typography.footnote.fontSize },
    goalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopColor: p.glassBorder,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Spacing.md,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionText: { color: p.accent, fontSize: Typography.footnote.fontSize },
    hint: { color: p.dim2, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
    // Form
    fieldLabel: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: Spacing.sm,
    },
    input: {
      backgroundColor: p.glassLightBg,
      borderColor: p.glassLightBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      color: p.ink,
      fontSize: Typography.body.fontSize,
    },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    amountInput: { flex: 1 },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchActive: { borderWidth: 3, borderColor: p.ink },
    formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    primary: {
      flex: 1,
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    primaryText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    secondary: {
      flex: 1,
      backgroundColor: p.glassLightBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    secondaryText: { color: p.ink, fontSize: Typography.headline.fontSize },
  });
