import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@components/AppIcon';
import { Money } from '@components/Money';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Spacing, Typography } from '@theme';

interface Props {
  fromMinorAbs: number;
  fromCurrency: string;
  toMinorAbs: number;
  toCurrency: string;
  /** 'row' for feed rows, 'hero' for the detail-sheet header. */
  size?: 'row' | 'hero';
}

/**
 * Neutral transfer amount — never a red "−". A same-currency transfer shows a
 * single amount; a cross-currency one shows source → destination (both
 * magnitudes), so both the sent and received sums are visible at a glance.
 */
export function TransferAmount({
  fromMinorAbs,
  fromCurrency,
  toMinorAbs,
  toCurrency,
  size = 'row',
}: Props) {
  const palette = usePalette();
  const styles = makeStyles(palette);
  const cross = fromCurrency !== toCurrency;
  const amountStyle = size === 'hero' ? styles.hero : styles.amount;

  if (!cross) {
    return <Money minor={fromMinorAbs} currency={fromCurrency} style={amountStyle} />;
  }

  return (
    <View style={size === 'hero' ? styles.wrapHero : styles.wrap}>
      <Money minor={fromMinorAbs} currency={fromCurrency} style={amountStyle} />
      <View style={styles.toRow}>
        <AppIcon name="arrow-forward" color={palette.dim2} size={size === 'hero' ? 16 : 12} />
        <Money minor={toMinorAbs} currency={toCurrency} style={styles.sub} />
      </View>
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: { alignItems: 'flex-end' },
    wrapHero: { alignItems: 'center', gap: Spacing.xs },
    amount: { color: p.ink, fontSize: Typography.row.fontSize },
    hero: {
      color: p.ink,
      fontSize: Typography.hero.fontSize,
      fontWeight: Typography.hero.fontWeight,
      textAlign: 'center',
    },
    toRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    sub: { color: p.dim, fontSize: Typography.caption.fontSize },
  });
