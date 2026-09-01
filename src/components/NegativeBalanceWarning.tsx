import { useTranslation } from 'react-i18next';
import { Alert, Pressable } from 'react-native';

import { AppIcon } from '@components/AppIcon';
import { usePalette } from '@hooks/usePalette';
import { hapticLight } from '@utils/haptics';

interface Props {
  /** Display name of the account, shown in the explanatory alert. */
  accountName: string;
  size?: number;
}

/**
 * A yellow warning shown next to an account whose balance has gone negative.
 * Tapping it explains that the account is in the red and what to do — the same
 * "colour means one thing" warning affordance as the Home allowance (rule 6:
 * warn is a caution, not an error).
 */
export function NegativeBalanceWarning({ accountName, size = 16 }: Props) {
  const { t } = useTranslation();
  const palette = usePalette();

  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        hapticLight();
        Alert.alert(
          t('accountSheet.negativeTitle'),
          t('accountSheet.negativeBody', { name: accountName }),
        );
      }}
      accessibilityRole="button"
      accessibilityLabel={t('accountSheet.negativeTitle')}
    >
      <AppIcon name="warning" color={palette.warn} size={size} />
    </Pressable>
  );
}
