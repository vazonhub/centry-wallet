import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COMMON_CURRENCIES } from '@constants/currencies';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { currencyName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';

interface Props {
  value: string;
  onChange: (code: string) => void;
}

/**
 * Currency picker as an expanding dropdown. The open list is an ABSOLUTE overlay
 * (top: 100%) so it never reflows the surrounding layout — the amount field next
 * to it no longer jumps when the list opens. The container is z-elevated while
 * open so the floating list paints above later siblings; the list is scrollable
 * and height-capped so it stays on-screen on a real device. Lists the common
 * currencies (B7 — any ISO code works, this is just the shortlist).
 */
export function CurrencyDropdown({ value, onChange }: Props) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const [open, setOpen] = useState(false);
  const selected = COMMON_CURRENCIES.find((c) => c.code === value);

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
        <Text style={styles.fieldText} numberOfLines={1}>
          {value}
          {selected ? ` · ${currencyName(selected.code)}` : ''}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.dim} />
      </Pressable>
      {open && (
        <View style={styles.list}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                    {c.code} · {currencyName(c.code)}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={palette.accent} />}
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
    // Relative anchor for the absolute list; z-elevated while open so the
    // floating list paints above sibling fields below it.
    root: { position: 'relative' },
    rootOpen: { zIndex: 1000 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    fieldText: { flexShrink: 1, color: p.ink, fontSize: Typography.body.fontSize },
    list: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.xs,
      borderRadius: Radius.md,
      // Opaque surface so content underneath doesn't show through the overlay.
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
    listScroll: { maxHeight: 240 },
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
