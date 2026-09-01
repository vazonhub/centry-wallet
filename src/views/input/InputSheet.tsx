import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import { openCategoryEditor } from '@components/categoryEditorRef';
import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { consumeInputPrefill, inputSheetRef } from '@components/inputSheetRef';
import { ACCOUNT_KIND_ICONS, type IoniconName } from '@constants/icons';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { Account, Category, TransactionKind } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayAccountName, displayCategoryName } from '@utils/displayName';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import {
  amountPlaceholder,
  applyCrossRate,
  convertFromBase,
  convertToBase,
  crossRateE6,
  formatMoney,
  formatRate,
  parseAmountToMinor,
  parseRateToE6,
  sanitizeAmountInput,
  sanitizeRateInput,
} from '@utils/money';

const E6_ONE = 1_000_000;
const ACCOUNT_KINDS: { kind: Account['kind']; icon: IoniconName }[] = [
  { kind: 'cash', icon: ACCOUNT_KIND_ICONS.cash },
  { kind: 'card', icon: ACCOUNT_KIND_ICONS.card },
  { kind: 'wallet', icon: ACCOUNT_KIND_ICONS.wallet },
];

type CreateTarget = 'main' | 'from' | 'to';

/**
 * The input sheet — the product's core (rule 4: ≤4s, ≤3 taps). Rendered once at
 * the app root; any screen opens it via `openInputSheet()` (direct ref).
 * One modal, content switches: expense/income, transfer (B12), and on-the-fly
 * account creation (D7).
 */
export function InputSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const rates = useDataStore((s) => s.rates);
  const base = useSettingsStore((s) => s.baseCurrency);
  const lastAccountId = useSettingsStore((s) => s.lastAccountId);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState<Date>(() => new Date());
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  // Cross-currency transfer override: the user either dictates the exchange RATE
  // (result is recomputed from it) or the FINAL amount (kept verbatim — a real
  // bank exchange with fees can differ). null = follow the market rate.
  const [transferOverride, setTransferOverride] = useState<{
    mode: 'rate' | 'final';
    text: string;
  } | null>(null);

  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState(base);
  const [newKind, setNewKind] = useState<Account['kind']>('cash');

  const account = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);
  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId),
    [accounts, fromAccountId],
  );
  const toAccount = useMemo(
    () => accounts.find((a) => a.id === toAccountId),
    [accounts, toAccountId],
  );
  const kindCategories = useMemo<Category[]>(
    () => categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense')),
    [categories, kind],
  );

  const rateOf = useCallback(
    (currency: string) => (currency === base ? E6_ONE : (rates[currency] ?? E6_ONE)),
    [base, rates],
  );

  const resetForm = useCallback(() => {
    const initial =
      lastAccountId ?? accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? null;
    setKind('expense');
    setAmount('');
    setNote('');
    setOccurredAt(new Date());
    setCategoryId(null);
    setAccountId(initial);
    setFromAccountId(initial);
    setToAccountId(accounts.find((a) => a.id !== initial)?.id ?? null);
    setTransferOverride(null);
    setCreateTarget(null);
  }, [lastAccountId, accounts]);

  const handleOpen = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Reset ONLY on the open transition (closed → open), at the START of the
      // animation. Doing it on onChange (which fires when the sheet settles) wiped
      // anything the user typed during the open animation.
      if (fromIndex !== -1 || toIndex < 0) return;
      resetForm();
      // Apply a Siri/App-Intent prefill on top of the fresh form (etap 8). The
      // amount is entered in the selected account's currency; sanitize it so it
      // matches that currency's precision.
      const prefill = consumeInputPrefill();
      if (!prefill) return;
      if (prefill.kind) setKind(prefill.kind);
      if (prefill.note) setNote(prefill.note);
      if (prefill.amount) {
        const initial =
          accounts.find((a) => a.id === lastAccountId) ??
          accounts.find((a) => a.isDefault) ??
          accounts[0];
        setAmount(sanitizeAmountInput(prefill.amount, initial?.currency ?? base));
      }
    },
    [resetForm, accounts, lastAccountId, base],
  );

  const onSaveEntry = useCallback(async () => {
    if (!account) return;
    const minor = parseAmountToMinor(amount, account.currency);
    if (minor == null || minor <= 0) return;
    await TransactionsController.addTransaction({
      accountId: account.id,
      currency: account.currency,
      kind: kind === 'income' ? 'income' : 'expense',
      amountMinorAbs: minor,
      categoryId,
      note: note.trim() || null,
      occurredAtSec: Math.floor(occurredAt.getTime() / 1000),
    });
    hapticSuccess();
    setAmount('');
    setNote('');
    setCategoryId(null);
    setOccurredAt(new Date());
    inputSheetRef.current?.dismiss();
  }, [account, amount, kind, categoryId, note, occurredAt]);

  const transfer = useMemo(() => {
    if (!fromAccount || !toAccount) return null;
    const from = fromAccount.currency;
    const to = toAccount.currency;
    const fromMinor = parseAmountToMinor(amount, from);
    if (fromMinor == null || fromMinor <= 0) return null;
    const sameCurrency = from === to;

    // The market result and the from→to rate it implies (defaults).
    const marketToMinor = sameCurrency
      ? fromMinor
      : convertFromBase(convertToBase(fromMinor, rateOf(from)), rateOf(to));
    const marketRateE6 = crossRateE6(fromMinor, from, marketToMinor, to) ?? E6_ONE;

    if (sameCurrency) {
      return { fromMinor, toMinor: fromMinor, sameCurrency, rateE6: E6_ONE, marketRateE6 };
    }

    // RATE override → recompute the result from the entered rate.
    if (transferOverride?.mode === 'rate') {
      const rateE6 = parseRateToE6(transferOverride.text) ?? marketRateE6;
      return {
        fromMinor,
        toMinor: applyCrossRate(fromMinor, from, rateE6, to),
        sameCurrency,
        rateE6,
        marketRateE6,
      };
    }

    // FINAL override → keep the entered amount; the rate is derived from it.
    if (transferOverride?.mode === 'final') {
      const entered = transferOverride.text.trim()
        ? parseAmountToMinor(transferOverride.text, to)
        : null;
      const toMinor = entered != null && entered > 0 ? entered : marketToMinor;
      return {
        fromMinor,
        toMinor,
        sameCurrency,
        rateE6: crossRateE6(fromMinor, from, toMinor, to) ?? marketRateE6,
        marketRateE6,
      };
    }

    // Follow the market rate.
    return { fromMinor, toMinor: marketToMinor, sameCurrency, rateE6: marketRateE6, marketRateE6 };
  }, [fromAccount, toAccount, amount, transferOverride, rateOf]);

  const onSaveTransfer = useCallback(async () => {
    if (!fromAccount || !toAccount || !transfer) return;
    if (fromAccount.id === toAccount.id || transfer.toMinor <= 0) return;
    await TransactionsController.addTransfer({
      fromAccountId: fromAccount.id,
      fromCurrency: fromAccount.currency,
      fromAmountMinorAbs: transfer.fromMinor,
      toAccountId: toAccount.id,
      toCurrency: toAccount.currency,
      toAmountMinorAbs: transfer.toMinor,
      note: note.trim() || null,
      occurredAtSec: Math.floor(occurredAt.getTime() / 1000),
    });
    hapticSuccess();
    setAmount('');
    setTransferOverride(null);
    setNote('');
    setOccurredAt(new Date());
    inputSheetRef.current?.dismiss();
  }, [fromAccount, toAccount, transfer, note, occurredAt]);

  const canSave =
    kind === 'transfer'
      ? transfer != null && fromAccount?.id !== toAccount?.id && transfer.toMinor > 0
      : account != null &&
        (() => {
          const m = account ? parseAmountToMinor(amount, account.currency) : null;
          return m != null && m > 0;
        })();

  const onSave = kind === 'transfer' ? onSaveTransfer : onSaveEntry;

  // Currency that the main amount field is entered in (drives sanitize precision).
  const mainCurrency =
    kind === 'transfer' ? (fromAccount?.currency ?? base) : (account?.currency ?? base);

  const beginCreate = useCallback(
    (target: CreateTarget) => {
      setCreateTarget(target);
      setNewName('');
      setNewCurrency(base);
      setNewKind('cash');
      hapticLight();
    },
    [base],
  );

  const onCreateAccount = useCallback(async () => {
    const name = newName.trim() || newCurrency;
    const acc = await TransactionsController.createAccount({
      name,
      currency: newCurrency,
      kind: newKind,
    });
    if (createTarget === 'from') setFromAccountId(acc.id);
    else if (createTarget === 'to') setToAccountId(acc.id);
    else setAccountId(acc.id);
    setCreateTarget(null);
    hapticSuccess();
  }, [newName, newCurrency, newKind, createTarget]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  const renderAccountChips = (
    selectedId: string | null,
    onSelect: (id: string) => void,
    target: CreateTarget,
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chipsScrollContent}
    >
      {accounts.map((a) => {
        const active = a.id === selectedId;
        return (
          <Pressable
            key={a.id}
            onPress={() => {
              onSelect(a.id);
              hapticLight();
            }}
            style={[styles.chip, styles.chipRow, active && styles.chipActive]}
          >
            <AppIcon
              name={a.icon}
              color={active ? palette.btnInk : palette.dim}
              size={14}
              fallback="wallet-outline"
            />
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {displayAccountName(a)} · {a.currency}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => beginCreate(target)} style={styles.chip}>
        <Text style={styles.chipText}>{t('input.addAccount')}</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <BottomSheetModal
      ref={inputSheetRef}
      snapPoints={['75%', '95%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      // `extend` grows the sheet to its tallest snap point when the keyboard
      // opens, keeping the amount field (top of the content) visible above the
      // keyboard. `interactive` instead slid the whole 75% sheet up by the
      // keyboard height, pushing the amount field off the top of the screen.
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onAnimate={handleOpen}
    >
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        {createTarget !== null ? (
          <>
            <Text style={styles.heading}>{t('input.newAccount')}</Text>
            <BottomSheetTextInput
              style={styles.note}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('input.namePlaceholder')}
              placeholderTextColor={palette.dim2}
            />
            <Text style={styles.label}>{t('input.currency')}</Text>
            <CurrencyDropdown value={newCurrency} onChange={setNewCurrency} />
            <Text style={styles.label}>{t('input.type')}</Text>
            <View style={styles.chipsRow}>
              {ACCOUNT_KINDS.map((k) => {
                const active = k.kind === newKind;
                return (
                  <Pressable
                    key={k.kind}
                    onPress={() => {
                      setNewKind(k.kind);
                      hapticLight();
                    }}
                    style={[styles.chip, styles.chipRow, active && styles.chipActive]}
                  >
                    <AppIcon
                      name={k.icon}
                      color={active ? palette.btnInk : palette.dim}
                      size={15}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {t(`input.kind_${k.kind}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => setCreateTarget(null)}
                style={[styles.save, styles.secondary]}
              >
                <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={onCreateAccount} style={styles.save}>
                <Text style={styles.saveText}>{t('input.create')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <SegmentedControl
              values={[t('input.expense'), t('input.income'), t('input.transfer')]}
              selectedIndex={kind === 'expense' ? 0 : kind === 'income' ? 1 : 2}
              onChange={(e) => {
                const i = e.nativeEvent.selectedSegmentIndex;
                setKind(i === 0 ? 'expense' : i === 1 ? 'income' : 'transfer');
                setCategoryId(null);
                setTransferOverride(null);
                hapticLight();
              }}
            />

            <View style={styles.amountRow}>
              <BottomSheetTextInput
                style={styles.amount}
                value={amount}
                onChangeText={(t) => setAmount(sanitizeAmountInput(t, mainCurrency))}
                placeholder={amountPlaceholder(mainCurrency)}
                placeholderTextColor={palette.dim2}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text style={styles.currency}>
                {kind === 'transfer' ? (fromAccount?.currency ?? '') : (account?.currency ?? '')}
              </Text>
            </View>

            {kind === 'transfer' ? (
              <>
                <Text style={styles.label}>{t('input.fromAccount')}</Text>
                {renderAccountChips(
                  fromAccountId,
                  (id) => {
                    setFromAccountId(id);
                    setTransferOverride(null);
                  },
                  'from',
                )}
                <Text style={styles.label}>{t('input.toAccount')}</Text>
                {renderAccountChips(
                  toAccountId,
                  (id) => {
                    setToAccountId(id);
                    setTransferOverride(null);
                  },
                  'to',
                )}
                {transfer && !transfer.sameCurrency && fromAccount && toAccount && (
                  <>
                    <Text style={styles.label}>{t('input.rateAndTotal')}</Text>
                    {/* Left = rate, right = final; ≈ between. Editing either side
                        recomputes the other (both always show current values). */}
                    <View style={styles.crossRow}>
                      <Text style={styles.rateHint}>1 {fromAccount.currency} =</Text>
                      <BottomSheetTextInput
                        style={styles.crossInput}
                        value={
                          transferOverride?.mode === 'rate'
                            ? transferOverride.text
                            : formatRate(transfer.rateE6)
                        }
                        onChangeText={(v) =>
                          setTransferOverride({ mode: 'rate', text: sanitizeRateInput(v) })
                        }
                        placeholder={formatRate(transfer.marketRateE6)}
                        placeholderTextColor={palette.dim2}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.approx}>≈</Text>
                      <BottomSheetTextInput
                        style={styles.crossInput}
                        value={
                          transferOverride?.mode === 'final'
                            ? transferOverride.text
                            : formatMoney(transfer.toMinor, toAccount.currency, { hideCode: true })
                        }
                        onChangeText={(v) =>
                          setTransferOverride({
                            mode: 'final',
                            text: sanitizeAmountInput(v, toAccount.currency),
                          })
                        }
                        placeholder={formatMoney(transfer.toMinor, toAccount.currency, {
                          hideCode: true,
                        })}
                        placeholderTextColor={palette.dim2}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.currency}>{toAccount.currency}</Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                {renderAccountChips(accountId, setAccountId, 'main')}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipsScroll}
                  contentContainerStyle={styles.chipsScrollContent}
                >
                  {kindCategories.map((c) => {
                    const active = c.id === categoryId;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setCategoryId(active ? null : c.id);
                          hapticLight();
                        }}
                        style={[
                          styles.cat,
                          active && {
                            backgroundColor: hexToRgba(c.color, 0.16),
                            borderColor: c.color,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.catBadge,
                            { backgroundColor: hexToRgba(c.color, active ? 0.3 : 0.16) },
                          ]}
                        >
                          <AppIcon name={c.icon} color={c.color} size={20} />
                        </View>
                        <Text
                          style={[styles.catText, active && styles.catTextActive]}
                          numberOfLines={1}
                        >
                          {displayCategoryName(c)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() =>
                      openCategoryEditor({ kind: kind === 'income' ? 'income' : 'expense' })
                    }
                    style={styles.cat}
                  >
                    <View style={[styles.catBadge, styles.catAddBadge]}>
                      <AppIcon name="add" color={palette.dim} size={20} />
                    </View>
                    <Text style={styles.catText} numberOfLines={1}>
                      {t('common.add')}
                    </Text>
                  </Pressable>
                </ScrollView>
              </>
            )}

            <BottomSheetTextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder={t('input.notePlaceholder')}
              placeholderTextColor={palette.dim2}
            />

            <View style={styles.dateRow}>
              <Text style={styles.label}>{t('input.date')}</Text>
              <DateTimePicker
                value={occurredAt}
                mode="date"
                display="compact"
                maximumDate={new Date()}
                onChange={(_, d) => d && setOccurredAt(d)}
              />
            </View>

            <Pressable
              disabled={!canSave}
              onPress={onSave}
              style={[styles.save, !canSave && styles.saveDisabled]}
            >
              <Text style={styles.saveText}>{t('common.save')}</Text>
            </Pressable>
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
    container: {
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.lg,
    },
    heading: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '600' },
    label: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    amount: {
      ...numberTextStyle,
      color: p.ink,
      fontSize: Typography.hero.fontSize,
      fontWeight: Typography.hero.fontWeight,
      minWidth: 120,
      textAlign: 'right',
    },
    currency: { ...numberTextStyle, color: p.dim, fontSize: Typography.title.fontSize },
    rateHint: { ...numberTextStyle, color: p.dim, fontSize: Typography.footnote.fontSize },
    // Cross-currency: [1 FROM =] [rate] ≈ [final] [TO] on one line.
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
    chipsRow: { gap: Spacing.sm, paddingVertical: Spacing.xs, flexDirection: 'row' },
    // Full-bleed horizontal chip lists: the ScrollView breaks out of the sheet's
    // screen padding so the list scrolls edge-to-edge, while the content keeps
    // the same inset (first/last chip aligned to the padding) — matching the
    // Home account chips and History filters.
    chipsScroll: { marginHorizontal: -Spacing.screenPadding },
    chipsScrollContent: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.screenPadding,
    },
    chip: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    chipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chipText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    chipTextActive: { color: p.btnInk },
    cat: {
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
      width: 76,
    },
    catBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catAddBadge: {
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    catText: { color: p.dim, fontSize: Typography.caption.fontSize, textAlign: 'center' },
    catTextActive: { color: p.ink, fontWeight: '600' },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    note: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    actionsRow: { flexDirection: 'row', gap: Spacing.md },
    save: {
      flex: 1,
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    saveDisabled: { opacity: 0.4 },
    saveText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    secondary: { backgroundColor: p.glassLightBg },
    secondaryText: { color: p.ink, fontSize: Typography.headline.fontSize, fontWeight: '600' },
  });
