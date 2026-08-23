import { useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import type { Account } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { numberTextStyle, Radius, Spacing, Typography } from '@theme';
import { hapticLight, hapticSuccess } from '@utils/haptics';
import {
  amountPlaceholder,
  minorToAmountInput,
  parseAmountToMinor,
  sanitizeAmountInput,
} from '@utils/money';

const ACCOUNT_KINDS: { kind: Account['kind']; label: string; icon: IoniconName }[] = [
  { kind: 'cash', label: 'Наличные', icon: ACCOUNT_KIND_ICONS.cash },
  { kind: 'card', label: 'Карта', icon: ACCOUNT_KIND_ICONS.card },
  { kind: 'wallet', label: 'Кошелёк', icon: ACCOUNT_KIND_ICONS.wallet },
];

/**
 * The single global account create/edit sheet (rendered once at the app root).
 * Opened imperatively via {@link openAccountSheet} from both Home and the
 * Accounts settings screen. Currency is locked while editing (D7 — a booked
 * transaction's frozen rate must not shift under it).
 */
export function AccountSheet() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [kind, setKind] = useState<Account['kind']>('cash');
  const [opening, setOpening] = useState('');

  useImperativeHandle(
    accountSheetRef,
    () => ({
      open(accountId?: string) {
        const account = accountId
          ? useDataStore.getState().accounts.find((a) => a.id === accountId)
          : undefined;
        if (account) {
          setEditingId(account.id);
          setName(account.name);
          setCurrency(account.currency);
          setKind(account.kind);
          setOpening(minorToAmountInput(account.openingMinor, account.currency));
        } else {
          setEditingId(null);
          setName('');
          setCurrency(useSettingsStore.getState().baseCurrency);
          setKind('cash');
          setOpening('');
        }
        sheetRef.current?.present();
        hapticLight();
      },
    }),
    [],
  );

  const onSubmit = async () => {
    const openingMinor = parseAmountToMinor(opening, currency) ?? 0;
    if (editingId) {
      await TransactionsController.updateAccount(editingId, {
        name: name.trim() || currency,
        kind,
        openingMinor,
      });
    } else {
      await TransactionsController.createAccount({
        name: name.trim() || currency,
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
      Alert.alert('Нельзя удалить счёт', 'Это ваш единственный счёт. Сначала создайте другой.');
      return;
    }
    Alert.alert(
      'Удалить счёт?',
      'Счёт скроется из кошелька, чипсов и фильтров. Записи по нему останутся в истории — курсы и суммы не переписываются.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await TransactionsController.deleteAccount(editingId);
              sheetRef.current?.dismiss();
              hapticSuccess();
            } catch (e) {
              Alert.alert('Не удалось удалить', e instanceof Error ? e.message : 'Ошибка.');
            }
          },
        },
      ],
    );
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
        <Text style={styles.heading}>{editingId ? 'Счёт' : 'Новый счёт'}</Text>
        <BottomSheetTextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Название (напр. Наличные USD)"
          placeholderTextColor={palette.dim2}
        />
        <Text style={styles.formLabel}>ВАЛЮТА</Text>
        {editingId ? (
          <View style={styles.currencyLocked}>
            <Text style={styles.currencyLockedText}>{currency}</Text>
            <Text style={styles.currencyLockedHint}>валюту счёта менять нельзя</Text>
          </View>
        ) : (
          <CurrencyDropdown value={currency} onChange={setCurrency} />
        )}
        <Text style={styles.formLabel}>СТАРТОВЫЙ БАЛАНС</Text>
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
        <Text style={styles.formLabel}>ТИП</Text>
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
                <Text style={[styles.kindText, active && styles.kindTextActive]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={onSubmit} style={styles.create}>
          <Text style={styles.createText}>{editingId ? 'Сохранить' : 'Создать'}</Text>
        </Pressable>
        {editingId && (
          <Pressable onPress={onDelete} style={styles.delete}>
            <Text style={styles.deleteText}>Удалить счёт</Text>
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
