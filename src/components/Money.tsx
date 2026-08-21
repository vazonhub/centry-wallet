import { Text, type TextProps } from 'react-native';

import { numberTextStyle } from '@theme';
import { formatMoney, type FormatMoneyOptions } from '@utils/money';

interface Props extends TextProps {
  minor: number;
  currency: string;
  options?: FormatMoneyOptions;
}

/**
 * The one way money reaches the screen (rule 7): formats through `@utils/money`
 * and always renders with the monospace tabular figures. Never format money
 * inline in a component — use this.
 */
export function Money({ minor, currency, options, style, ...rest }: Props) {
  return (
    <Text {...rest} style={[numberTextStyle, style]}>
      {formatMoney(minor, currency, options)}
    </Text>
  );
}
