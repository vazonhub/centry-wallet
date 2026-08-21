import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { hapticLight, hapticSuccess } from '@utils/haptics';
import { scheduleSlots } from '@utils/schedule';
import {
  amountPlaceholder,
  convertFromBase,
  convertToBase,
  formatMoney,
  parseAmountToMinor,
  sanitizeAmountInput,
} from '@utils/money';

const E6_ONE = 1_000_000;
const ACCOUNT_KINDS: { kind: Account['kind']; label: string; icon: IoniconName }[] = [
  { kind: 'cash', label: 'Наличные', icon: ACCOUNT_KIND_ICONS.cash },
  { kind: 'card', label: 'Карта', icon: ACCOUNT_KIND_ICONS.card },
  { kind: 'wallet', label: 'Кошелёк', icon: ACCOUNT_KIND_ICONS.wallet },
];

type CreateTarget = 'main' | 'from' | 'to';

/**
 * The input sheet — the product's core (rule 4: ≤4s, ≤3 taps). Rendered once at
 * the app root; any screen opens it via `openInputSheet()` (direct ref).
 * One modal, content switches: expense/income, transfer (B12), and on-the-fly
 * account creation (D7).
 */
export function InputSheet() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const accounts = useDataStore((s) => s.accounts);
  const categories = useDataStore((s) => s.categories);
  const rates = useDataStore((s) => s.rates);
  const base = useSettingsStore((s) => s.baseCurrency);
  const lastAccountId = useSettingsStore((s) => s.lastAccountId);
  const payoutSchedule = useSettingsStore((s) => s.payoutSchedule);
  const slots = useMemo(() => scheduleSlots(payoutSchedule), [payoutSchedule]);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [markRegular, setMarkRegular] = useState(false);
  const [regularSlotId, setRegularSlotId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<Date>(() => new Date());
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [amountTo, setAmountTo] = useState('');

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
    setMarkRegular(false);
    setRegularSlotId(null);
    setOccurredAt(new Date());
    setCategoryId(null);
    setAccountId(initial);
    setFromAccountId(initial);
    setToAccountId(accounts.find((a) => a.id !== initial)?.id ?? null);
    setAmountTo('');
    setCreateTarget(null);
  }, [lastAccountId, accounts]);

  const handleChange = useCallback(
    (index: number) => {
      if (index < 0) return;
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
      regularSlotId: kind === 'income' && markRegular ? (regularSlotId ?? slots[0]?.id) : undefined,
    });
    hapticSuccess();
    setAmount('');
    setNote('');
    setCategoryId(null);
    setMarkRegular(false);
    setRegularSlotId(null);
    setOccurredAt(new Date());
    inputSheetRef.current?.dismiss();
  }, [account, amount, kind, categoryId, note, markRegular, regularSlotId, slots, occurredAt]);

  const transfer = useMemo(() => {
    if (!fromAccount || !toAccount) return null;
    const fromMinor = parseAmountToMinor(amount, fromAccount.currency);
    if (fromMinor == null || fromMinor <= 0) return null;
    const sameCurrency = fromAccount.currency === toAccount.currency;
    const suggestedTo = sameCurrency
      ? fromMinor
      : convertFromBase(
          convertToBase(fromMinor, rateOf(fromAccount.currency)),
          rateOf(toAccount.currency),
        );
    const manualTo = amountTo.trim() ? parseAmountToMinor(amountTo, toAccount.currency) : null;
    return { fromMinor, toMinor: manualTo ?? suggestedTo, suggestedTo, sameCurrency };
  }, [fromAccount, toAccount, amount, amountTo, rateOf]);

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
    setAmountTo('');
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
      contentContainerStyle={styles.chipsRow}
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
              {a.name} · {a.currency}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => beginCreate(target)} style={styles.chip}>
        <Text style={styles.chipText}>＋ Счёт</Text>
      </Pressable>
    </ScrollView>
  );

  return (
    <BottomSheetModal
      ref={inputSheetRef}
      snapPoints={['75%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onChange={handleChange}
    >
      <BottomSheetScrollView contentContainerStyle={styles.container}>
        {createTarget !== null ? (
          <>
            <Text style={styles.heading}>Новый счёт</Text>
            <BottomSheetTextInput
              style={styles.note}
              value={newName}
              onChangeText={setNewName}
              placeholder="Название (напр. Наличные USD)"
              placeholderTextColor={palette.dim2}
            />
            <Text style={styles.label}>ВАЛЮТА</Text>
            <CurrencyDropdown value={newCurrency} onChange={setNewCurrency} />
            <Text style={styles.label}>ТИП</Text>
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
                      {k.label}
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
                <Text style={styles.secondaryText}>Отмена</Text>
              </Pressable>
              <Pressable onPress={onCreateAccount} style={styles.save}>
                <Text style={styles.saveText}>Создать</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <SegmentedControl
              values={['Расход', 'Доход', 'Перевод']}
              selectedIndex={kind === 'expense' ? 0 : kind === 'income' ? 1 : 2}
              onChange={(e) => {
                const i = e.nativeEvent.selectedSegmentIndex;
                setKind(i === 0 ? 'expense' : i === 1 ? 'income' : 'transfer');
                setCategoryId(null);
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
                <Text style={styles.label}>СО СЧЁТА</Text>
                {renderAccountChips(fromAccountId, setFromAccountId, 'from')}
                <Text style={styles.label}>НА СЧЁТ</Text>
                {renderAccountChips(toAccountId, setToAccountId, 'to')}
                {transfer && !transfer.sameCurrency && toAccount && (
                  <>
                    <Text style={styles.label}>ИТОГ ({toAccount.currency})</Text>
                    <View style={styles.amountRow}>
                      <BottomSheetTextInput
                        style={styles.amountSmall}
                        value={amountTo}
                        onChangeText={(t) =>
                          setAmountTo(sanitizeAmountInput(t, toAccount.currency))
                        }
                        placeholder={formatMoney(transfer.suggestedTo, toAccount.currency, {
                          hideCode: true,
                        })}
                        placeholderTextColor={palette.dim2}
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.rateHint}>
                        ≈ {formatMoney(transfer.toMinor, toAccount.currency)}
                      </Text>
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
                  contentContainerStyle={styles.chipsRow}
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
                          {c.name}
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
                      Добавить
                    </Text>
                  </Pressable>
                </ScrollView>
                {kind === 'income' && (
                  <>
                    <Pressable
                      style={styles.regularRow}
                      onPress={() => {
                        setMarkRegular((v) => !v);
                        if (!markRegular) setRegularSlotId(slots[0]?.id ?? null);
                        hapticLight();
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: markRegular }}
                    >
                      <AppIcon
                        name={markRegular ? 'checkbox' : 'square-outline'}
                        color={markRegular ? palette.accent : palette.dim}
                        size={22}
                      />
                      <View style={styles.regularTextWrap}>
                        <Text style={styles.regularTitle}>Регулярная выплата</Text>
                        <Text style={styles.regularHint}>Обновит ожидаемую сумму на период</Text>
                      </View>
                    </Pressable>
                    {markRegular && slots.length > 1 && (
                      <>
                        <Text style={styles.label}>ЗА КАКУЮ ВЫПЛАТУ</Text>
                        <View style={styles.chipsRow}>
                          {slots.map((slot) => {
                            const active = (regularSlotId ?? slots[0]?.id) === slot.id;
                            return (
                              <Pressable
                                key={slot.id}
                                onPress={() => {
                                  setRegularSlotId(slot.id);
                                  hapticLight();
                                }}
                                style={[styles.chip, active && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                  {slot.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            <BottomSheetTextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder="Заметка (необязательно)"
              placeholderTextColor={palette.dim2}
            />

            <View style={styles.dateRow}>
              <Text style={styles.label}>ДАТА</Text>
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
              <Text style={styles.saveText}>Сохранить</Text>
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
    amountSmall: {
      ...numberTextStyle,
      color: p.ink,
      fontSize: Typography.title.fontSize,
      minWidth: 100,
      textAlign: 'right',
    },
    currency: { ...numberTextStyle, color: p.dim, fontSize: Typography.title.fontSize },
    rateHint: { ...numberTextStyle, color: p.dim, fontSize: Typography.footnote.fontSize },
    chipsRow: { gap: Spacing.sm, paddingVertical: Spacing.xs, flexDirection: 'row' },
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
    regularRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    regularTextWrap: { flex: 1 },
    regularTitle: { color: p.ink, fontSize: Typography.body.fontSize },
    regularHint: { color: p.dim, fontSize: Typography.caption.fontSize },
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
