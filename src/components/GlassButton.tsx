import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useIsDark, usePalette } from '@hooks/usePalette';
import type { Palette } from '@theme';
import { Radius } from '@theme';

interface Props {
  onPress: () => void;
  children: ReactNode;
  /** Extra style on the outer container (sizing, margins). */
  style?: StyleProp<ViewStyle>;
  /** Content padding inside the glass. */
  contentStyle?: StyleProp<ViewStyle>;
  round?: boolean;
  accessibilityLabel?: string;
}

/**
 * Liquid-glass control (Bsuir Time style): a blurred, translucent surface with
 * a hairline border and a bright top highlight. Used for the back button and
 * other floating affordances so they read as glass over the canvas.
 */
export function GlassButton({
  onPress,
  children,
  style,
  contentStyle,
  round,
  accessibilityLabel,
}: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const styles = makeStyles(palette);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.wrap,
        { borderRadius: round ? 999 : Radius.pill },
        pressed && styles.pressed,
        style,
      ]}
    >
      <BlurView
        intensity={palette.glassBlurIntensity}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.blur, { borderRadius: round ? 999 : Radius.pill }]}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </BlurView>
    </Pressable>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: {
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.glassBg,
    },
    pressed: { opacity: 0.7 },
    blur: { overflow: 'hidden' },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
