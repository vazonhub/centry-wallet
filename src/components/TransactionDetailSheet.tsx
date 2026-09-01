import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AccountDropdown } from '@components/AccountDropdown';
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
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { currentTzOffsetMin } from '@utils/date';
import { displayCategoryName } from '@utils/displayName';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import {
  amountPlaceholder,
  applyCrossRate,
  convertToBase,
  crossRateE6,
  formatMoney,
  formatRate,
  localDay,
  minorToAmountInput,
  parseAmountToMinor,
  parseRateToE6,
  sanitizeAmountInput,
  sanitizeRateInput,
} from '@utils/money';

const E6_ONE = 1_000_000;

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
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const sheetRef = useRef<BottomSheetModal>(null);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const base = useSettingsStore((s) => s.baseCurrency);

  const [tx, setTx] = useState<Transaction | null>(null);
  // The other leg of a transfer (so both amounts can be edited together).
  const [sibling, setSibling] = useState<Transaction | null>(null);
  // Editable amount text (magnitude in the tx's own currency), seeded on open.
  const [amountText, setAmountText] = useState('');
  // Transfer editing: the source magnitude text, plus a rate/final override that
  // works exactly like the input sheet (edit the rate → final recomputes; edit
  // the final → rate recomputes; otherwise the stored rate is kept).
  const [fromText, setFromText] = useState('');
  const [transferOverride, setTransferOverride] = useState<{
    mode: 'rate' | 'final';
    text: string;
  } | null>(null);
  const onChangedRef = useRef<(() => void) | undefined>(undefined);

  const open = useCallback((next: Transaction, onChanged?: () => void, pair?: Transaction) => {
    setTx(next);
    setSibling(pair ?? null);
    setAmountText(minorToAmountInput(Math.abs(next.amountMinor), next.currency));
    // Seed the source field from the from-leg (the negative one of the pair).
    const fromLeg = next.amountMinor < 0 ? next : (pair ?? next);
    setFromText(minorToAmountInput(Math.abs(fromLeg.amountMinor), fromLeg.currency));
    setTransferOverride(null);
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

  // Only same-currency accounts can host this transaction (balances sum amounts
  // without conversion), so the picker offers just those.
  const detailAccounts = useMemo(
    () => (tx ? accounts.filter((a) => a.currency === tx.currency) : []),
    [accounts, tx],
  );

  const onPickAccount = useCallback(
    async (accountId: string) => {
      if (!tx || tx.accountId === accountId) return;
      const prev = tx;
      setTx({ ...prev, accountId }); // optimistic
      try {
        await TransactionsController.editTransactionAccount(prev.id, accountId);
        onChangedRef.current?.();
        hapticLight();
      } catch {
        setTx(prev); // revert if the move was rejected
      }
    },
    [tx],
  );

  // Derived transfer values from the two legs + the edit fields (mirrors the
  // input sheet). `from`/`to` are the negative/positive legs of the pair.
  const transferEdit = useMemo(() => {
    if (!tx?.transferPairId) return null;
    const from = tx.amountMinor < 0 ? tx : sibling;
    const to = tx.amountMinor > 0 ? tx : sibling;
    if (!from || !to) return null;
    const fromCur = from.currency;
    const toCur = to.currency;
    const sameCurrency = fromCur === toCur;
    const origFromMinor = Math.abs(from.amountMinor);
    const origToMinor = Math.abs(to.amountMinor);
    const baseRateE6 = crossRateE6(origFromMinor, fromCur, origToMinor, toCur) ?? E6_ONE;
    const fromMinor = parseAmountToMinor(fromText, fromCur) ?? origFromMinor;

    let toMinor: number;
    let rateE6: number;
    if (sameCurrency) {
      toMinor = fromMinor;
      rateE6 = E6_ONE;
    } else if (transferOverride?.mode === 'rate') {
      rateE6 = parseRateToE6(transferOverride.text) ?? baseRateE6;
      toMinor = applyCrossRate(fromMinor, fromCur, rateE6, toCur);
    } else if (transferOverride?.mode === 'final') {
      const entered = transferOverride.text.trim()
        ? parseAmountToMinor(transferOverride.text, toCur)
        : null;
      toMinor = entered != null && entered > 0 ? entered : origToMinor;
      rateE6 = crossRateE6(fromMinor, fromCur, toMinor, toCur) ?? baseRateE6;
    } else {
      // Rate-locked: keep the stored rate; no drift when nothing changed.
      rateE6 = baseRateE6;
      toMinor =
        fromMinor === origFromMinor
          ? origToMinor
          : applyCrossRate(fromMinor, fromCur, baseRateE6, toCur);
    }
    const dirty = fromMinor !== origFromMinor || toMinor !== origToMinor;
    return {
      from,
      to,
      fromCur,
      toCur,
      sameCurrency,
      fromMinor,
      toMinor,
      rateE6,
      baseRateE6,
      dirty,
    };
  }, [tx, sibling, fromText, transferOverride]);

  const onPickTransferAccount = useCallback(
    async (side: 'from' | 'to', accountId: string) => {
      if (!tx?.transferPairId || !transferEdit) return;
      const leg = side === 'from' ? transferEdit.from : transferEdit.to;
      if (leg.accountId === accountId) return;
      const apply = (l: Transaction) => (l.id === leg.id ? { ...l, accountId } : l);
      const prevTx = tx;
      const prevSib = sibling;
      setTx(apply(tx)); // optimistic
      setSibling(sibling ? apply(sibling) : null);
      try {
        await TransactionsController.editTransferAccount(tx.transferPairId, side, accountId);
        onChangedRef.current?.();
        hapticLight();
      } catch {
        setTx(prevTx);
        setSibling(prevSib);
      }
    },
    [tx, sibling, transferEdit],
  );

  const commitTransfer = useCallback(async () => {
    if (!tx?.transferPairId || !transferEdit || !transferEdit.dirty) return;
    const { from, to, fromMinor, toMinor } = transferEdit;
    if (fromMinor <= 0 || toMinor <= 0) return;
    await TransactionsController.editTransfer(tx.transferPairId, {
      fromMinorAbs: fromMinor,
      toMinorAbs: toMinor,
    });
    const newFrom = { ...from, amountMinor: -fromMinor };
    const newTo = { ...to, amountMinor: toMinor };
    if (tx.id === from.id) {
      setTx(newFrom);
      setSibling(newTo);
    } else {
      setTx(newTo);
      setSibling(newFrom);
    }
    setFromText(minorToAmountInput(fromMinor, from.currency));
    setTransferOverride(null);
    onChangedRef.current?.();
    hapticSuccess();
  }, [tx, transferEdit]);

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
      t('detail.note'),
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
  }, [tx, t]);

  const onDelete = useCallback(() => {
    if (!tx) return;
    const current = tx;
    Alert.alert(t('detail.deleteTitle'), t('detail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await TransactionsController.deleteTransaction(current.id);
          sheetRef.current?.dismiss();
          onChangedRef.current?.();
        },
      },
    ]);
  }, [tx, t]);

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
      snapPoints={['60%', '92%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onDismiss={() => {
        setTx(null);
        setSibling(null);
      }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.detail}>
        {tx && (
          <>
            {isTransfer ? (
              transferEdit ? (
                <>
                  {/* Source amount (from-account currency). */}
                  <View style={styles.amountEditRow}>
                    <BottomSheetTextInput
                      style={[styles.detailAmount, styles.amountInput, { color: palette.ink }]}
                      value={fromText}
                      onChangeText={(v) => {
                        setTransferOverride(null);
                        setFromText(sanitizeAmountInput(v, transferEdit.fromCur));
                      }}
                      keyboardType="decimal-pad"
                      placeholder={amountPlaceholder(transferEdit.fromCur)}
                      placeholderTextColor={palette.dim2}
                    />
                    <Text style={styles.amountCurrency}>{transferEdit.fromCur}</Text>
                  </View>
                  {!transferEdit.sameCurrency && (
                    <>
                      <Text style={styles.sectionTitle}>{t('input.rateAndTotal')}</Text>
                      {/* Left rate, right final, ≈ between — edit either. */}
                      <View style={styles.crossRow}>
                        <Text style={styles.rateHint}>1 {transferEdit.fromCur} =</Text>
                        <BottomSheetTextInput
                          style={styles.crossInput}
                          value={
                            transferOverride?.mode === 'rate'
                              ? transferOverride.text
                              : formatRate(transferEdit.rateE6)
                          }
                          onChangeText={(v) =>
                            setTransferOverride({ mode: 'rate', text: sanitizeRateInput(v) })
                          }
                          keyboardType="decimal-pad"
                          placeholderTextColor={palette.dim2}
                        />
                        <Text style={styles.approx}>≈</Text>
                        <BottomSheetTextInput
                          style={styles.crossInput}
                          value={
                            transferOverride?.mode === 'final'
                              ? transferOverride.text
                              : formatMoney(transferEdit.toMinor, transferEdit.toCur, {
                                  hideCode: true,
                                })
                          }
                          onChangeText={(v) =>
                            setTransferOverride({
                              mode: 'final',
                              text: sanitizeAmountInput(v, transferEdit.toCur),
                            })
                          }
                          keyboardType="decimal-pad"
                          placeholderTextColor={palette.dim2}
                        />
                        <Text style={styles.amountCurrency}>{transferEdit.toCur}</Text>
                      </View>
                    </>
                  )}
                  {transferEdit.dirty && (
                    <Pressable onPress={() => void commitTransfer()} style={styles.save}>
                      <Text style={styles.saveText}>{t('common.save')}</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Money
                  minor={tx.amountMinor}
                  currency={tx.currency}
                  options={{ showPlus: false }}
                  style={[styles.detailAmount, { color: palette.ink }]}
                />
              )
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
                    placeholder={amountPlaceholder(tx.currency)}
                    placeholderTextColor={palette.dim2}
                    onEndEditing={() => void commitAmount()}
                  />
                  <Text style={styles.amountCurrency}>{tx.currency}</Text>
                </View>
                <Text style={styles.editHint}>{t('detail.editHint')}</Text>
              </>
            )}
            {!isTransfer && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldRowLabel}>{t('detail.account')}</Text>
                <AccountDropdown
                  value={tx.accountId}
                  accounts={detailAccounts}
                  onChange={(id) => void onPickAccount(id)}
                />
              </View>
            )}

            {isTransfer && transferEdit && (
              <View style={styles.fromToRow}>
                <View style={styles.fromToCol}>
                  <Text style={styles.sectionTitle}>{t('detail.fromAccount')}</Text>
                  <AccountDropdown
                    value={transferEdit.from.accountId}
                    accounts={accounts.filter(
                      (a) =>
                        a.currency === transferEdit.fromCur && a.id !== transferEdit.to.accountId,
                    )}
                    onChange={(id) => void onPickTransferAccount('from', id)}
                  />
                </View>
                <View style={styles.fromToCol}>
                  <Text style={styles.sectionTitle}>{t('detail.toAccount')}</Text>
                  <AccountDropdown
                    value={transferEdit.to.accountId}
                    accounts={accounts.filter(
                      (a) =>
                        a.currency === transferEdit.toCur && a.id !== transferEdit.from.accountId,
                    )}
                    onChange={(id) => void onPickTransferAccount('to', id)}
                  />
                </View>
              </View>
            )}

            <View style={styles.detailRows}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('detail.date')}</Text>
                <DateTimePicker
                  value={new Date(tx.occurredAt * 1000)}
                  mode="date"
                  display="compact"
                  maximumDate={new Date()}
                  onChange={(_, d) => void onPickDate(d)}
                />
              </View>
              {!isTransfer && (
                <>
                  <DetailRow
                    label={t('detail.rateToBase')}
                    value={`${(tx.rateToBaseE6 / 1_000_000).toFixed(4)} ${base}`}
                    styles={styles}
                  />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('detail.inBase')}</Text>
                    <Money
                      minor={convertToBase(tx.amountMinor, tx.rateToBaseE6)}
                      currency={base}
                      options={{ showPlus: true }}
                      style={styles.detailValue}
                    />
                  </View>
                </>
              )}
            </View>

            {!isTransfer && (
              <>
                <Text style={styles.sectionTitle}>{t('detail.category')}</Text>
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
                          {displayCategoryName(c)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <Pressable onPress={onEditNote} style={[styles.actionBtn, styles.secondary]}>
                <Text style={styles.secondaryText}>{t('detail.note')}</Text>
              </Pressable>
              <Pressable onPress={onDelete} style={[styles.actionBtn, styles.danger]}>
                <Text style={[styles.dangerText, { color: WHITE }]}>{t('common.delete')}</Text>
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
    // Cross-currency transfer edit: [1 FROM =] [rate] ≈ [final] [TO] on one line.
    crossRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    crossInput: {
      ...numberTextStyle,
      flex: 1,
      color: p.ink,
      fontSize: Typography.headline.fontSize,
      textAlign: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    approx: { ...numberTextStyle, color: p.dim, fontSize: Typography.title.fontSize },
    rateHint: { ...numberTextStyle, color: p.dim, fontSize: Typography.footnote.fontSize },
    save: {
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
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
      alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    // Account picker as a field row: label left, dropdown right.
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    fieldRowLabel: { color: p.dim, fontSize: Typography.body.fontSize },
    // Transfer: source and destination account pickers side by side.
    fromToRow: { flexDirection: 'row', gap: Spacing.md },
    fromToCol: { flex: 1, gap: Spacing.xs },
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
