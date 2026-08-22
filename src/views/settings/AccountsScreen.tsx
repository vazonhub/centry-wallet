import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@components/AppIcon';
import { openAccountSheet } from '@components/accountSheetRef';
import { Money } from '@components/Money';
import { ScreenHeader } from '@components/ScreenHeader';
import { usePalette } from '@hooks/usePalette';
import { useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, TAB_BAR_HEIGHT, Typography } from '@theme';

export function AccountsScreen() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const accounts = useDataStore((s) => s.accounts);
  const balances = useDataStore((s) => s.balances);
  const insets = useSafeAreaInsets();

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
            <Pressable key={a.id} style={styles.row} onPress={() => openAccountSheet(a.id)}>
              <View style={styles.labelRow}>
                <AppIcon name={a.icon} color={palette.dim} size={18} fallback="wallet-outline" />
                <Text style={styles.label} numberOfLines={1}>
                  {a.name} · {a.currency}
                </Text>
              </View>
              <Money minor={balances[a.id] ?? 0} currency={a.currency} style={styles.value} />
            </Pressable>
          ))}
          <Pressable onPress={() => openAccountSheet()} style={styles.row}>
            <Text style={styles.action}>＋ Добавить счёт</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  });
