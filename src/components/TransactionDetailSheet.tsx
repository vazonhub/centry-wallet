import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import { Money } from '@components/Money';
import {
  transactionDetailRef,
  type TransactionDetailHandle,
} from '@components/transactionDetailRef';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { Category, Transaction } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { currentTzOffsetMin } from '@utils/date';
import { hapticLight } from '@utils/haptics';
import {
  amountPlaceholder,
  convertToBase,
  localDay,
  minorToAmountInput,
  parseAmountToMinor,
  sanitizeAmountInput,
} from '@utils/money';

const WHITE = '#ffffff'; // white text on the saturated red delete button (both themes)

function DetailRow({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Shared transaction-detail sheet (D20). Rendered once at the app root, opened
 * via {@link openTransactionDetail} from the History list and the Home feed.
 * Shows the frozen rate / base amount and allows changing category, note, and
 * deleting. Mutations flow through the controllers (which refresh the data
 * store); `onChanged` refreshes the opener's own view.
 */
export function TransactionDetailSheet() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sheetRef = useRef<BottomSheetModal>(null);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const base = useSettingsStore((s) => s.baseCurrency);

  const [tx, setTx] = useState<Transaction | null>(null);
  // Editable amount text (magnitude in the tx's own currency), seeded on open.
  const [amountText, setAmountText] = useState('');
  const onChangedRef = useRef<(() => void) | undefined>(undefined);

  const open = useCallback((next: Transaction, onChanged?: () => void) => {
    setTx(next);
    setAmountText(minorToAmountInput(Math.abs(next.amountMinor), next.currency));
    onChangedRef.current = onChanged;
    sheetRef.current?.present();
    hapticLight();
  }, []);

  useImperativeHandle(transactionDetailRef, (): TransactionDetailHandle => ({ open }), [open]);

  const detailCategories = useMemo<Category[]>(
    () =>
      tx ? categories.filter((c) => c.kind === (tx.kind === 'income' ? 'income' : 'expense')) : [],
    [categories, tx],
  );

  const onPickCategory = useCallback(
    async (categoryId: string | null) => {
      if (!tx) return;
      await TransactionsController.editTransactionMeta(tx.id, { categoryId });
      setTx({ ...tx, categoryId });
      onChangedRef.current?.();
      hapticLight();
    },
    [tx],
  );

  const onPickDate = useCallback(
    async (date?: Date) => {
      if (!tx || !date) return;
      const sec = Math.floor(date.getTime() / 1000);
      await TransactionsController.editTransactionDate(tx.id, sec);
      setTx({ ...tx, occurredAt: sec, localDay: localDay(sec, currentTzOffsetMin()) });
      onChangedRef.current?.();
    },
    [tx],
  );

  // Commit the edited amount (on blur / done). Same numeric input as creation,
  // pre-filled with the current value. Keeps the sign from the kind; restores the
  // field on invalid/empty input. Not for transfers.
  const commitAmount = useCallback(async () => {
    if (!tx || tx.kind === 'transfer') return;
    const current = tx;
    const kind = current.kind === 'income' ? 'income' : 'expense';
    const abs = parseAmountToMinor(amountText, current.currency);
    if (abs == null || abs <= 0) {
      setAmountText(minorToAmountInput(Math.abs(current.amountMinor), current.currency));
      return;
    }
    const signed = kind === 'income' ? abs : -abs;
    if (signed === current.amountMinor) return;
    await TransactionsController.editTransactionAmount(current.id, abs, kind);
    setTx({ ...current, amountMinor: signed });
    onChangedRef.current?.();
    hapticLight();
  }, [tx, amountText]);

  const onEditNote = useCallback(() => {
    if (!tx) return;
    const current = tx;
    Alert.prompt(
      'Заметка',
      undefined,
      async (value?: string) => {
        const note = value?.trim() || null;
        await TransactionsController.editTransactionMeta(current.id, { note });
        setTx({ ...current, note });
        onChangedRef.current?.();
      },
      'plain-text',
      current.note ?? '',
    );
  }, [tx]);

  const onDelete = useCallback(() => {
    if (!tx) return;
    const current = tx;
    Alert.alert('Удалить запись?', 'Действие можно отменить только повторным вводом.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await TransactionsController.deleteTransaction(current.id);
          sheetRef.current?.dismiss();
          onChangedRef.current?.();
        },
      },
    ]);
  }, [tx]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  const isTransfer = tx?.kind === 'transfer';

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['60%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={() => setTx(null)}
    >
      <BottomSheetScrollView contentContainerStyle={styles.detail}>
        {tx && (
          <>
            {isTransfer ? (
              <Money
                minor={tx.amountMinor}
                currency={tx.currency}
                options={{ showPlus: false }}
                style={[styles.detailAmount, { color: palette.ink }]}
              />
            ) : (
              <>
                <View style={styles.amountEditRow}>
                  <Text
                    style={[
                      styles.amountSign,
                      { color: tx.amountMinor >= 0 ? palette.pos : palette.ink },
                    ]}
                  >
                    {tx.kind === 'income' ? '+' : '−'}
                  </Text>
                  <BottomSheetTextInput
                    style={[
                      styles.detailAmount,
                      styles.amountInput,
                      { color: tx.amountMinor >= 0 ? palette.pos : palette.ink },
                    ]}
                    value={amountText}
                    onChangeText={(t) => setAmountText(sanitizeAmountInput(t, tx.currency))}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    placeholder={amountPlaceholder(tx.currency)}
                    placeholderTextColor={palette.dim2}
                    onEndEditing={() => void commitAmount()}
                    onSubmitEditing={() => void commitAmount()}
                  />
                  <Text style={styles.amountCurrency}>{tx.currency}</Text>
                </View>
                <Text style={styles.editHint}>нажмите на сумму, чтобы изменить</Text>
              </>
            )}
            <View style={styles.detailRows}>
              <DetailRow
                label="Счёт"
                value={accounts.find((a) => a.id === tx.accountId)?.name ?? '—'}
                styles={styles}
              />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Дата</Text>
                <DateTimePicker
                  value={new Date(tx.occurredAt * 1000)}
                  mode="date"
                  display="compact"
                  maximumDate={new Date()}
                  onChange={(_, d) => void onPickDate(d)}
                />
              </View>
              <DetailRow
                label="Курс к базе"
                value={`${(tx.rateToBaseE6 / 1_000_000).toFixed(4)} ${base}`}
                styles={styles}
              />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>В базе</Text>
                <Money
                  minor={convertToBase(tx.amountMinor, tx.rateToBaseE6)}
                  currency={base}
                  options={{ showPlus: !isTransfer }}
                  style={styles.detailValue}
                />
              </View>
            </View>

            {!isTransfer && (
              <>
                <Text style={styles.sectionTitle}>КАТЕГОРИЯ</Text>
                <View style={styles.catWrap}>
                  {detailCategories.map((c) => {
                    const active = c.id === tx.categoryId;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => void onPickCategory(active ? null : c.id)}
                        style={[styles.chip, styles.chipRow, active && styles.chipActive]}
                      >
                        <AppIcon
                          name={c.icon}
                          color={active ? palette.btnInk : c.color}
                          size={14}
                        />
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <Pressable onPress={onEditNote} style={[styles.actionBtn, styles.secondary]}>
                <Text style={styles.secondaryText}>Заметка</Text>
              </Pressable>
              <Pressable onPress={onDelete} style={[styles.actionBtn, styles.danger]}>
                <Text style={[styles.dangerText, { color: WHITE }]}>Удалить</Text>
              </Pressable>
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    sheetBg: { backgroundColor: p.sheetBg },
    handle: { backgroundColor: p.dim2 },
    detail: {
      paddingHorizontal: Spacing.screenPadding,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.md,
    },
    detailAmount: {
      fontSize: Typography.hero.fontSize,
      fontWeight: Typography.hero.fontWeight,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    editHint: {
      color: p.dim2,
      fontSize: Typography.caption.fontSize,
      textAlign: 'center',
      marginTop: 2,
    },
    amountEditRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    amountSign: { fontSize: Typography.hero.fontSize, fontWeight: Typography.hero.fontWeight },
    amountInput: { marginTop: 0, textAlign: 'right', minWidth: 60, paddingVertical: 0 },
    amountCurrency: { color: p.dim, fontSize: Typography.title.fontSize, fontWeight: '600' },
    detailRows: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
    },
    detailLabel: { color: p.dim, fontSize: Typography.body.fontSize },
    detailValue: { color: p.ink, fontSize: Typography.body.fontSize },
    sectionTitle: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: Spacing.sm,
    },
    catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    chipText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    chipTextActive: { color: p.btnInk },
    actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
    actionBtn: {
      flex: 1,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    secondary: { backgroundColor: p.glassLightBg },
    secondaryText: { color: p.ink, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    danger: { backgroundColor: p.neg },
    dangerText: { fontSize: Typography.headline.fontSize, fontWeight: '600' },
  });
