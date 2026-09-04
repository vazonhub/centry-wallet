import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@components/AppIcon';
import { openGoalsSheet } from '@components/goalsSheetRef';
import { ProgressRing } from '@components/ProgressRing';
import { usePalette } from '@hooks/usePalette';
import { selectGoals, useDataStore } from '@stores/data.store';
import type { Palette } from '@theme';
import { Radius, Spacing, Typography } from '@theme';
import { hexToRgba } from '@utils/color';
import { displayAccountName } from '@utils/displayName';
import { hapticLight } from '@utils/haptics';

const RING = 46;

/**
 * The Home goal-rings strip — a coloured progress ring per savings goal, sitting
 * between the date/total row and the hero. Tapping any ring (or the trailing "+")
 * opens the goals sheet. Collapses to a single "add goal" pill when there are no
 * goals yet, keeping the feature discoverable without cluttering Home.
 */
export function GoalsStrip() {
  const { t } = useTranslation();
  const palette = usePalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const goals = useDataStore(selectGoals);
  const balances = useDataStore((s) => s.balances);

  const open = (goalId?: string) => {
    hapticLight();
    openGoalsSheet(goalId);
  };

  if (goals.length === 0) {
    return (
      <Pressable style={styles.addPill} onPress={() => open()}>
        <AppIcon name="flag-outline" color={palette.dim} size={16} />
        <Text style={styles.addPillText}>{t('goals.title')}</Text>
        <AppIcon name="add" color={palette.dim} size={16} />
      </Pressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {goals.map((g) => {
        const saved = balances[g.id] ?? 0;
        const target = g.targetMinor ?? 0;
        const progress = target > 0 ? saved / target : 0;
        const color = g.color ?? palette.accent;
        return (
          <Pressable key={g.id} style={styles.item} onPress={() => open(g.id)}>
            <ProgressRing
              size={RING}
              stroke={5}
              progress={progress}
              color={color}
              trackColor={hexToRgba(color, 0.18)}
            >
              <Text style={[styles.pct, { color }]}>{Math.round(Math.min(1, progress) * 100)}</Text>
            </ProgressRing>
            <Text style={styles.name} numberOfLines={1}>
              {displayAccountName(g)}
            </Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.item} onPress={() => open()}>
        <View style={styles.addRing}>
          <AppIcon name="add" color={palette.dim} size={20} />
        </View>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    scroll: { marginHorizontal: -Spacing.screenPadding },
    row: {
      flexDirection: 'row',
      gap: Spacing.md,
      paddingHorizontal: Spacing.screenPadding,
    },
    item: { alignItems: 'center', width: 64, gap: 4 },
    pct: {
      fontSize: Typography.caption.fontSize,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    name: {
      color: p.dim,
      fontSize: Typography.caption.fontSize,
      maxWidth: 64,
      textAlign: 'center',
    },
    addRing: {
      width: RING,
      height: RING,
      borderRadius: RING / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.glassLightBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.pill,
      backgroundColor: p.glassLightBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassLightBorder,
    },
    addPillText: { color: p.dim, fontSize: Typography.footnote.fontSize },
  });
