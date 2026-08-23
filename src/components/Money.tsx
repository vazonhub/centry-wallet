import { Text, type TextProps } from 'react-native';

import { numberTextStyle } from '@theme';
import { formatMoney, formatMoneyCompact, type FormatMoneyOptions } from '@utils/money';

interface Props extends TextProps {
  minor: number;
  currency: string;
  options?: FormatMoneyOptions;
  /** Abbreviate large values (≥10 000) as 10k / 1,5m to fit tight blocks. */
  compact?: boolean;
}

/**
 * The one way money reaches the screen (rule 7): formats through `@utils/money`
 * and always renders with the monospace tabular figures. Never format money
 * inline in a component — use this.
 */
export function Money({ minor, currency, options, compact, style, ...rest }: Props) {
  const format = compact ? formatMoneyCompact : formatMoney;
  return (
    <Text {...rest} style={[numberTextStyle, style]}>
      {format(minor, currency, options)}
    </Text>
  );
}
