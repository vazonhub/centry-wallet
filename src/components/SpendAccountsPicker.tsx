import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@components/AppIcon';
import { usePalette } from '@hooks/usePalette';
import { useDataStore } from '@stores/data.store';
import { useSettingsStore } from '@stores/settings.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { displayAccountName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';

/**
 * "Целевые счета трат" — picks which accounts' expenses count toward "можно
 * сегодня" and the monthly warning. A single "all accounts" switch (the default);
 * turning it off reveals a per-account checklist that starts fully checked. Goal
 * accounts are never listed (their moves are transfers, never daily spend).
 *
 * Reads/writes the settings store directly so it drops into both the settings
 * screen and the onboarding flow unchanged.
 */
export function SpendAccountsPicker() {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { t } = useTranslation();

  const accounts = useDataStore((s) => s.accounts);
  const spendAccountIds = useSettingsStore((s) => s.spendAccountIds);
  const setSpendAccountIds = useSettingsStore((s) => s.setSpendAccountIds);

  // Goal accounts can never be spend accounts, so they never appear here.
  const eligible = useMemo(() => accounts.filter((a) => (a.kind as string) !== 'goal'), [accounts]);

  const allSelected = spendAccountIds === null;
  const selected = useMemo(
    () => new Set(spendAccountIds ?? eligible.map((a) => a.id)),
    [spendAccountIds, eligible],
  );

  const onToggleAll = (value: boolean) => {
    hapticLight();
    // Off → materialize the current accounts as an explicit, fully-checked list
    // so the user can start unchecking; on → back to "all" (auto-covers new ones).
    setSpendAccountIds(value ? null : eligible.map((a) => a.id));
  };

  const onToggleAccount = (id: string) => {
    hapticLight();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSpendAccountIds([...next]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('spendAccounts.allAccounts')}</Text>
          <Switch
            value={allSelected}
            onValueChange={onToggleAll}
            trackColor={{ true: palette.accent, false: palette.dim2 }}
          />
        </View>
        {!allSelected &&
          eligible.map((a) => {
            const on = selected.has(a.id);
            return (
              <Pressable
                key={a.id}
                onPress={() => onToggleAccount(a.id)}
                style={[styles.row, styles.rowTop]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={displayAccountName(a)}
              >
                <View style={styles.accountName}>
                  <AppIcon name={a.icon} color={palette.dim} size={16} fallback="wallet-outline" />
                  <Text style={styles.label} numberOfLines={1}>
                    {displayAccountName(a)}
                  </Text>
                </View>
                <AppIcon
                  name={on ? 'checkbox' : 'square-outline'}
                  color={on ? palette.accent : palette.dim2}
                  size={22}
                />
              </Pressable>
            );
          })}
      </View>
      <Text style={styles.hint}>{t('spendAccounts.hint')}</Text>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { gap: Spacing.xs },
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
    rowTop: { borderTopColor: p.glassBorder, borderTopWidth: StyleSheet.hairlineWidth },
    accountName: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    label: { color: p.ink, fontSize: Typography.body.fontSize, flexShrink: 1 },
    hint: {
      color: p.dim2,
      fontSize: Typography.footnote.fontSize,
      lineHeight: 18,
      marginLeft: Spacing.xs,
    },
  });
