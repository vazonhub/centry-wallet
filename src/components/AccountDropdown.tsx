import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppIcon } from '@components/AppIcon';
import { usePalette } from '@hooks/usePalette';
import type { Account } from '@models';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { displayAccountName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';

interface Props {
  value: string | null;
  accounts: Account[];
  onChange: (accountId: string) => void;
}

/**
 * Account picker as an expanding dropdown (mirrors {@link CurrencyDropdown}). The
 * open list is an ABSOLUTE overlay so it floats over following content instead of
 * reflowing it. The caller passes the eligible accounts (already filtered by the
 * required currency).
 */
export function AccountDropdown({ value, accounts, onChange }: Props) {
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value);

  return (
    <View style={[styles.root, open && styles.rootOpen]}>
      <Pressable
        style={styles.field}
        onPress={() => {
          setOpen((o) => !o);
          hapticLight();
        }}
        accessibilityRole="button"
      >
        <View style={styles.fieldLeft}>
          {selected && (
            <AppIcon name={selected.icon} color={palette.dim} size={16} fallback="wallet-outline" />
          )}
          <Text style={styles.fieldText} numberOfLines={1}>
            {selected ? displayAccountName(selected) : '—'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={palette.dim} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {accounts.map((a) => {
              const active = a.id === value;
              return (
                <Pressable
                  key={a.id}
                  style={styles.item}
                  onPress={() => {
                    onChange(a.id);
                    setOpen(false);
                    hapticLight();
                  }}
                >
                  <View style={styles.fieldLeft}>
                    <AppIcon
                      name={a.icon}
                      color={active ? palette.accent : palette.dim}
                      size={16}
                      fallback="wallet-outline"
                    />
                    <Text
                      style={[styles.itemText, active && styles.itemTextActive]}
                      numberOfLines={1}
                    >
                      {displayAccountName(a)}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark" size={16} color={palette.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    root: { position: 'relative', flexShrink: 1, minWidth: 140 },
    rootOpen: { zIndex: 1000 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    fieldLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
    fieldText: { flexShrink: 1, color: p.ink, fontSize: Typography.body.fontSize },
    list: {
      position: 'absolute',
      top: '100%',
      right: 0,
      minWidth: 180,
      marginTop: Spacing.xs,
      borderRadius: Radius.md,
      backgroundColor: p.sheetBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      overflow: 'hidden',
      zIndex: 1000,
      elevation: 12,
      shadowColor: p.glassShadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    listScroll: { maxHeight: 220 },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    itemText: { color: p.dim, fontSize: Typography.body.fontSize, flexShrink: 1 },
    itemTextActive: { color: p.ink, fontWeight: '600' },
  });
