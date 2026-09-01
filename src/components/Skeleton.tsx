import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '@hooks/usePalette';
import { Radius } from '@theme';
import { hexToRgba } from '@utils/color';

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single pulsing placeholder block — the app-wide loading primitive. Compose
 * several to shape a screen's skeleton (rows, bars, cards). Distinct from an
 * empty state: skeleton means "loading", an empty state means "no data".
 */
export function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: Props) {
  const palette = usePalette();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.4 }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: hexToRgba(palette.ink, 0.1) },
        animStyle,
        style,
      ]}
    />
  );
}
