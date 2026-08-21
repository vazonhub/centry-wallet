import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COMMON_CURRENCIES } from '@constants/currencies';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hapticLight } from '@utils/haptics';

interface Props {
  value: string;
  onChange: (code: string) => void;
}

/**
 * Currency picker as an expanding dropdown (replaces the old chip row). Inline
 * so it works inside a bottom sheet's scroll view; the list pushes content down
 * rather than floating. Lists the common currencies (B7 — any ISO code works,
 * this is just the shortlist).
 */
export function CurrencyDropdown({ value, onChange }: Props) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const [open, setOpen] = useState(false);
  const selected = COMMON_CURRENCIES.find((c) => c.code === value);

  return (
    <View>
      <Pressable
        style={styles.field}
        onPress={() => {
          setOpen((o) => !o);
          hapticLight();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.fieldText}>
          {value}
          {selected ? ` · ${selected.name}` : ''}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.dim} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          {COMMON_CURRENCIES.map((c) => {
            const active = c.code === value;
            return (
              <Pressable
                key={c.code}
                style={styles.item}
                onPress={() => {
                  onChange(c.code);
                  setOpen(false);
                  hapticLight();
                }}
              >
                <Text style={[styles.itemText, active && styles.itemTextActive]}>
                  {c.code} · {c.name}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={palette.accent} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    fieldText: { color: p.ink, fontSize: Typography.body.fontSize },
    list: {
      marginTop: Spacing.xs,
      borderRadius: Radius.md,
      backgroundColor: p.glassBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    itemText: { color: p.dim, fontSize: Typography.body.fontSize },
    itemTextActive: { color: p.ink, fontWeight: '600' },
  });
