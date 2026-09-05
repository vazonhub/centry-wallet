import { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import { accountSheetRef } from '@components/accountSheetRef';
import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { ACCOUNT_KIND_ICONS, type IoniconName } from '@constants/icons';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { SpendAccountKind } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { displayAccountName } from '@utils/displayName';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import {
  amountPlaceholder,
  formatRate,
  minorToAmountInput,
  parseAmountToMinor,
  parseRateToE6,
  sanitizeAmountInput,
  sanitizeRateInput,
} from '@utils/money';

const E6_ONE = 1_000_000;

type KindKey = 'accountSheet.kindCash' | 'accountSheet.kindCard' | 'accountSheet.kindWallet';
const ACCOUNT_KINDS: { kind: SpendAccountKind; labelKey: KindKey; icon: IoniconName }[] = [
  { kind: 'cash', labelKey: 'accountSheet.kindCash', icon: ACCOUNT_KIND_ICONS.cash },
  { kind: 'card', labelKey: 'accountSheet.kindCard', icon: ACCOUNT_KIND_ICONS.card },
  { kind: 'wallet', labelKey: 'accountSheet.kindWallet', icon: ACCOUNT_KIND_ICONS.wallet },
];

/**
 * The single global account create/edit sheet (rendered once at the app root).
 * Opened imperatively via {@link openAccountSheet} from both Home and the
 * Accounts settings screen. Currency is locked while editing (D7 — a booked
 * transaction's frozen rate must not shift under it).
 */
export function AccountSheet() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const rates = useDataStore((s) => s.rates);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  // The account's currency when the sheet opened; a change triggers conversion.
  const [origCurrency, setOrigCurrency] = useState(baseCurrency);
  const [kind, setKind] = useState<SpendAccountKind>('cash');
  const [opening, setOpening] = useState('');
  // Editable from→to conversion rate (×1e6 text), prefilled with the market rate.
  const [rateText, setRateText] = useState('');

  const rateOf = (c: string) => (c === baseCurrency ? E6_ONE : (rates[c] ?? E6_ONE));
  // Market rate origCurrency → target (×1e6): how many target units one old unit buys.
  const marketRateE6 = (to: string) => Math.round((rateOf(origCurrency) * E6_ONE) / rateOf(to));
  const currencyChanged = editingId != null && currency !== origCurrency;
  // For a seeded account we pre-fill the field with the localized display name;
  // { stored, display } lets onSubmit keep the original stored name when the
  // user leaves it unchanged, so its localization is preserved.
  const seedNameRef = useRef<{ stored: string; display: string } | null>(null);

  useImperativeHandle(
    accountSheetRef,
    () => ({
      open(accountId?: string) {
        const account = accountId
          ? useDataStore.getState().accounts.find((a) => a.id === accountId)
          : undefined;
        if (account) {
          const display = displayAccountName(account);
          setEditingId(account.id);
          setName(display);
          seedNameRef.current = { stored: account.name, display };
          setCurrency(account.currency);
          setOrigCurrency(account.currency);
          // Goals are edited in their own sheet, never here — fall back to 'cash'.
          setKind(account.kind === 'goal' ? 'cash' : account.kind);
          setOpening(minorToAmountInput(account.openingMinor, account.currency));
        } else {
          const base = useSettingsStore.getState().baseCurrency;
          setEditingId(null);
          setName('');
          seedNameRef.current = null;
          setCurrency(base);
          setOrigCurrency(base);
          setKind('cash');
          setOpening('');
        }
        setRateText('');
        sheetRef.current?.present();
        hapticLight();
      },
    }),
    [],
  );

  const onSubmit = async () => {
    // Unchanged localized name → keep the original stored name (preserve i18n).
    const typed = name.trim();
    const resolvedName =
      seedNameRef.current && typed === seedNameRef.current.display
        ? seedNameRef.current.stored
        : typed || currency;

    if (editingId && currencyChanged) {
      // Currency switch: rewrite name/kind/opening (still in the OLD currency),
      // then convert the whole account to the new currency at the entered rate.
      const rateE6 = parseRateToE6(rateText) ?? marketRateE6(currency);
      Alert.alert(
        t('accountSheet.convertTitle'),
        t('accountSheet.convertBody', { from: origCurrency, to: currency }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('accountSheet.convertConfirm'),
            onPress: async () => {
              const openingMinor = parseAmountToMinor(opening, origCurrency) ?? 0;
              await TransactionsController.updateAccount(editingId, {
                name: resolvedName,
                kind,
                openingMinor,
              });
              await TransactionsController.changeAccountCurrency(editingId, currency, rateE6);
              sheetRef.current?.dismiss();
              hapticSuccess();
            },
          },
        ],
      );
      return;
    }

    const openingMinor = parseAmountToMinor(opening, currency) ?? 0;
    if (editingId) {
      await TransactionsController.updateAccount(editingId, {
        name: resolvedName,
        kind,
        openingMinor,
      });
    } else {
      await TransactionsController.createAccount({
        name: resolvedName,
        currency,
        kind,
        openingMinor,
      });
    }
    sheetRef.current?.dismiss();
    hapticSuccess();
  };

  const onDelete = () => {
    if (!editingId) return;
    const accounts = useDataStore.getState().accounts;
    if (accounts.length <= 1) {
      Alert.alert(t('accountSheet.cannotDeleteTitle'), t('accountSheet.cannotDeleteBody'));
      return;
    }
    Alert.alert(t('accountSheet.deleteConfirmTitle'), t('accountSheet.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await TransactionsController.deleteAccount(editingId);
            sheetRef.current?.dismiss();
            hapticSuccess();
          } catch (e) {
            Alert.alert(
              t('accountSheet.deleteFailedTitle'),
              e instanceof Error ? e.message : t('accountSheet.genericError'),
            );
          }
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
      snapPoints={['68%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.form}>
        <Text style={styles.heading}>
          {editingId ? t('accountSheet.title') : t('accountSheet.titleNew')}
        </Text>
        <BottomSheetTextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('accountSheet.namePlaceholder')}
          placeholderTextColor={palette.dim2}
        />
        <Text style={styles.formLabel}>{t('accountSheet.currencyLabel')}</Text>
        <CurrencyDropdown
          value={currency}
          onChange={(c) => {
            setCurrency(c);
            // Prefill the editable conversion rate with the market rate.
            if (editingId && c !== origCurrency) setRateText(formatRate(marketRateE6(c)));
          }}
        />
        {currencyChanged && (
          <>
            <Text style={styles.formLabel}>{t('accountSheet.convertRateLabel')}</Text>
            <View style={styles.amountRow}>
              <Text style={styles.rateHint}>1 {origCurrency} =</Text>
              <BottomSheetTextInput
                style={styles.amountInput}
                value={rateText}
                onChangeText={(v) => setRateText(sanitizeRateInput(v))}
                placeholder={formatRate(marketRateE6(currency))}
                placeholderTextColor={palette.dim2}
                keyboardType="decimal-pad"
              />
              <Text style={styles.amountCurrency}>{currency}</Text>
            </View>
            <Text style={styles.convertWarning}>
              {t('accountSheet.convertWarning', { from: origCurrency, to: currency })}
            </Text>
          </>
        )}
        <Text style={styles.formLabel}>{t('accountSheet.openingBalanceLabel')}</Text>
        <View style={styles.amountRow}>
          <BottomSheetTextInput
            style={styles.amountInput}
            value={opening}
            onChangeText={(t) => setOpening(sanitizeAmountInput(t, currency))}
            placeholder={amountPlaceholder(currency)}
            placeholderTextColor={palette.dim2}
            keyboardType="decimal-pad"
          />
          <Text style={styles.amountCurrency}>{currency}</Text>
        </View>
        <Text style={styles.formLabel}>{t('accountSheet.kindLabel')}</Text>
        <View style={styles.kindRow}>
          {ACCOUNT_KINDS.map((k) => {
            const active = k.kind === kind;
            return (
              <Pressable
                key={k.kind}
                onPress={() => {
                  setKind(k.kind);
                  hapticLight();
                }}
                style={[styles.kindChip, active && styles.kindChipActive]}
              >
                <AppIcon name={k.icon} color={active ? palette.btnInk : palette.dim} size={15} />
                <Text style={[styles.kindText, active && styles.kindTextActive]}>
                  {t(k.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onSubmit} style={styles.create}>
          <Text style={styles.createText}>
            {editingId ? t('common.save') : t('accountSheet.create')}
          </Text>
        </Pressable>
        {editingId && (
          <Pressable onPress={onDelete} style={styles.delete}>
            <Text style={styles.deleteText}>{t('accountSheet.deleteAccount')}</Text>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    sheetBg: { backgroundColor: p.sheetBg },
    handle: { backgroundColor: p.dim2 },
    form: {
      paddingHorizontal: Spacing.screenPadding,
      paddingBottom: Spacing.xxxl,
      gap: Spacing.md,
    },
    heading: { color: p.ink, fontSize: Typography.title.fontSize, fontWeight: '600' },
    input: {
      color: p.ink,
      fontSize: Typography.body.fontSize,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    formLabel: {
      color: p.dim,
      fontSize: Typography.micro.fontSize,
      fontWeight: '700',
      letterSpacing: 1,
    },
    currencyLocked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    currencyLockedText: { color: p.ink, fontSize: Typography.body.fontSize },
    currencyLockedHint: { color: p.dim2, fontSize: Typography.caption.fontSize },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
    },
    amountInput: {
      ...numberTextStyle,
      flex: 1,
      color: p.ink,
      fontSize: Typography.headline.fontSize,
    },
    amountCurrency: { color: p.dim, fontSize: Typography.body.fontSize },
    rateHint: { ...numberTextStyle, color: p.dim, fontSize: Typography.footnote.fontSize },
    convertWarning: { color: p.warn, fontSize: Typography.caption.fontSize, lineHeight: 17 },
    kindRow: { flexDirection: 'row', gap: Spacing.sm },
    kindChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    kindChipActive: { backgroundColor: p.btnBg, borderColor: p.btnBg },
    kindText: { color: p.ink, fontSize: Typography.footnote.fontSize },
    kindTextActive: { color: p.btnInk },
    create: {
      backgroundColor: p.btnBg,
      borderRadius: Radius.inputButton,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    createText: { color: p.btnInk, fontSize: Typography.headline.fontSize, fontWeight: '600' },
    delete: { alignItems: 'center', paddingVertical: Spacing.md },
    deleteText: { color: p.neg, fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  });
