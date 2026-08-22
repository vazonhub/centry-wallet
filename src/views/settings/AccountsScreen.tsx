import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { AppIcon } from '@components/AppIcon';
import { CurrencyDropdown } from '@components/CurrencyDropdown';
import { Money } from '@components/Money';
import { ScreenHeader } from '@components/ScreenHeader';
import { ACCOUNT_KIND_ICONS, type IoniconName } from '@constants/icons';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { Account } from '@models';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';
import { hapticLight, hapticSuccess } from '@utils/haptics';

const ACCOUNT_KINDS: { kind: Account['kind']; label: string; icon: IoniconName }[] = [
  { kind: 'cash', label: 'Наличные', icon: ACCOUNT_KIND_ICONS.cash },
  { kind: 'card', label: 'Карта', icon: ACCOUNT_KIND_ICONS.card },
  { kind: 'wallet', label: 'Кошелёк', icon: ACCOUNT_KIND_ICONS.wallet },
];

export function AccountsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const baseCurrency = useSettingsStore((s) => s.baseCurrency);
  const insets = useSafeAreaInsets();

  const sheetRef = useRef<BottomSheetModal>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [kind, setKind] = useState<Account['kind']>('cash');

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setCurrency(baseCurrency);
    setKind('cash');
    sheetRef.current?.present();
    hapticLight();
  };

  const openEdit = (a: Account) => {
    setEditingId(a.id);
    setName(a.name);
    setCurrency(a.currency);
    setKind(a.kind);
    sheetRef.current?.present();
    hapticLight();
  };

  const onSubmit = async () => {
    if (editingId) {
      await TransactionsController.updateAccount(editingId, {
        name: name.trim() || currency,
        kind,
      });
    } else {
      await TransactionsController.createAccount({ name: name.trim() || currency, currency, kind });
    }
    sheetRef.current?.dismiss();
    hapticSuccess();
  };

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
  );

  return (
    <View style={styles.canvas}>
      <ScreenHeader title="Счета" />
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {accounts.map((a) => (
            <Pressable key={a.id} style={styles.row} onPress={() => openEdit(a)}>
              <View style={styles.labelRow}>
                <AppIcon name={a.icon} color={palette.dim} size={18} fallback="wallet-outline" />
                <Text style={styles.label} numberOfLines={1}>
                  {a.name} · {a.currency}
                </Text>
              </View>
              <Money minor={balances[a.id] ?? 0} currency={a.currency} style={styles.value} />
            </Pressable>
          ))}
          <Pressable onPress={openAdd} style={styles.row}>
            <Text style={styles.action}>＋ Добавить счёт</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['60%']}
        enableDynamicSizing={false}
        enablePanDownToClose
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
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    body: { paddingTop: Spacing.screenPadding, paddingHorizontal: Spacing.screenPadding },
    card: {
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.lg,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: Spacing.md,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1 },
    label: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    value: { color: p.ink, fontSize: Typography.body.fontSize },
    action: { color: p.pos, fontSize: Typography.body.fontSize },
    // Add-account sheet
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
  });
