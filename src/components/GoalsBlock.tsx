import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { AppIcon } from '@components/AppIcon';
import { openGoalsSheet } from '@components/goalsSheetRef';
import { ProgressRing } from '@components/ProgressRing';
import { usePalette } from '@hooks/usePalette';
import { selectGoals, useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hexToRgba, mixHex } from '@utils/color';
import { hapticLight } from '@utils/haptics';

// Kept small (≈ the sibling cards' icon/text height) so the goal block never
// makes the top row taller — the row stretches to its tallest card.
const RING = 16;
const STROKE = 2.5;
const MAX_RINGS = 4;

/**
 * Compact goals block for the Home top row — sits between the date card and the
 * wallet-total card, matching their glass-card look. Shows a colour progress
 * ring per goal (up to {@link MAX_RINGS}, overlapping left-to-right, with a "+N"
 * badge when there are more). Tapping opens the goals sheet. With no goals yet it
 * degrades to a small "add goal" affordance so the feature stays reachable.
 */
export function GoalsBlock() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const goals = useDataStore(useShallow(selectGoals));
  const balances = useDataStore((s) => s.balances);

  const open = () => {
    hapticLight();
    openGoalsSheet();
  };

  if (goals.length === 0) {
    return (
      <Pressable
        style={styles.card}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('goals.title')}
      >
        <AppIcon name="flag-outline" color={palette.dim} size={16} />
        <AppIcon name="add" color={palette.dim} size={13} />
      </Pressable>
    );
  }

  const shown = goals.slice(0, MAX_RINGS);
  const extra = goals.length - shown.length;

  return (
    <Pressable
      style={styles.card}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={t('goals.title')}
    >
      <View style={styles.rings}>
        {shown.map((g, i) => {
          const saved = balances[g.id] ?? 0;
          const target = g.targetMinor ?? 0;
          const progress = target > 0 ? saved / target : 0;
          const color = g.color ?? palette.accent;
          return (
            <View
              key={g.id}
              style={[
                styles.ringWrap,
                // Opaque backdrop tinted toward this goal's colour (not a flat
                // dark) so the overlap masks cleanly and reads as its own ring.
                { backgroundColor: mixHex(palette.canvasBase, color, 0.28) },
                i > 0 && styles.ringOverlap,
              ]}
            >
              <ProgressRing
                size={RING}
                stroke={STROKE}
                progress={progress}
                color={color}
                trackColor={hexToRgba(color, 0.2)}
              />
            </View>
          );
        })}
      </View>
      {extra > 0 && <Text style={styles.more}>+{extra}</Text>}
    </Pressable>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    card: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: p.glassBg,
      borderColor: p.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: Radius.card,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    rings: { flexDirection: 'row', alignItems: 'center' },
    // Each ring gets an OPAQUE, goal-tinted background (set inline per goal) so
    // the top ring cleanly masks the one beneath at the overlap instead of
    // letting it bleed through, plus a small shadow cast leftward — since each
    // ring stacks on top of the previous one, the shadow falls on the ring
    // beneath and makes the overlap read as a distinct stack, not a flat blend.
    ringWrap: {
      borderRadius: RING / 2,
      shadowColor: p.ink,
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
      shadowOffset: { width: -1.5, height: 0 },
    },
    ringOverlap: { marginLeft: -6 },
    more: {
      color: p.dim,
      fontSize: Typography.caption.fontSize,
      fontVariant: ['tabular-nums'],
    },
  });
