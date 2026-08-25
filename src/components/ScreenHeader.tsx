import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GlassButton } from '@components/GlassButton';
import { usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { ScreenTitle, Spacing, textProps } from '@theme';

interface Props {
  title: string;
  /** Optional trailing element rendered on the title row's right side. */
  right?: React.ReactNode;
}

/**
 * Custom sub-page header (settings sections, etc.). Replaces the default native
 * nav bar: a liquid-glass back button top-left with the large screen title
 * below, aligned to the same left margin as the headerless index screens
 * (Bsuir каркас). Sub-page routes set `headerShown: false`.
 */
export function ScreenHeader({ title, right }: Props) {
  const palette = usePalette();
  const router = useRouter();
  const { t } = useTranslation();
  const styles = makeStyles(palette);

  return (
    <SafeAreaView edges={['top']}>
      <View style={styles.row}>
        <GlassButton
          round
          onPress={() => router.back()}
          accessibilityLabel={t('common.back')}
          contentStyle={styles.backContent}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </GlassButton>
        <Text {...textProps('title')} style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.right}>{right}</View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.screenPadding,
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    backContent: { width: 38, height: 38 },
    title: { ...ScreenTitle, color: p.ink, flex: 1 },
    right: { marginLeft: 'auto' },
  });
