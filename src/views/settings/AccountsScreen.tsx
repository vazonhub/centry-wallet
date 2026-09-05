import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { AppIcon } from '@components/AppIcon';
import { openAccountSheet } from '@components/accountSheetRef';
import { DragSortList } from '@components/DragSortList';
import { Money } from '@components/Money';
import { NegativeBalanceWarning } from '@components/NegativeBalanceWarning';
import { ScreenHeader } from '@components/ScreenHeader';
import { TransactionsController } from '@controllers/transactions.controller';
import { usePalette } from '@hooks/usePalette';
import type { Account } from '@models';
import { selectSpendAccounts, useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';
import { displayAccountName } from '@utils/displayName';

export function AccountsScreen() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const accounts = useDataStore(useShallow(selectSpendAccounts));
  const balances = useDataStore((s) => s.balances);
  const insets = useSafeAreaInsets();
  // Freeze page scroll while an account is being dragged.
  const [dragging, setDragging] = useState(false);

  // Each account is its own glass card (with air between them) so it reads as a
  // discrete, grab-and-move block — the drag handle affordance is the whole card.
  const renderAccount = (a: Account) => (
    <Pressable style={styles.accountCard} onPress={() => openAccountSheet(a.id)}>
      <View style={styles.labelRow}>
        <AppIcon name="reorder-three" color={palette.dim2} size={20} />
        <AppIcon name={a.icon} color={palette.dim} size={18} fallback="wallet-outline" />
        <Text style={styles.label} numberOfLines={1}>
          {displayAccountName(a)} · {a.currency}
        </Text>
        {(balances[a.id] ?? 0) < 0 && (
          <NegativeBalanceWarning accountName={displayAccountName(a)} />
        )}
      </View>
      <Money minor={balances[a.id] ?? 0} currency={a.currency} style={styles.value} />
    </Pressable>
  );

  return (
    <View style={styles.canvas}>
      <ScreenHeader title={t('accounts.title')} />
      <ScrollView
        scrollEnabled={!dragging}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DragSortList
          data={accounts}
          keyExtractor={(a) => a.id}
          renderItem={renderAccount}
          onReorder={(ids) => void TransactionsController.reorderAccounts(ids)}
          onDragStateChange={setDragging}
          liftShadowColor={palette.ink}
          gap={Spacing.sm}
          footer={
            <Pressable onPress={() => openAccountSheet()} style={styles.addCard}>
              <Text style={styles.action}>＋ {t('accounts.addAccount')}</Text>
            </Pressable>
          }
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    canvas: { flex: 1, backgroundColor: p.canvasBase },
    body: { paddingTop: Spacing.screenPadding, paddingHorizontal: Spacing.screenPadding },
    accountCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    addCard: {
      alignItems: 'center',
      backgroundColor: p.glassLightBg,
      borderColor: p.glassLightBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.lg,
      // Sits a touch below the last account card (DragSortList gap adds the rest).
      marginTop: Spacing.xs,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 1 },
    label: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    value: { color: p.ink, fontSize: Typography.body.fontSize },
    action: { color: p.pos, fontSize: Typography.body.fontSize },
  });
