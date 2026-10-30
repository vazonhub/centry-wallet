import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  size: number;
  /** Ring thickness in px. */
  stroke: number;
  /** Fill fraction 0..1 (clamped). */
  progress: number;
  /** Filled-arc colour. */
  color: string;
  /** Unfilled-track colour. */
  trackColor: string;
  /** Optional centre content (icon / label) rendered over the ring. */
  children?: React.ReactNode;
}

/**
 * A circular progress ring (SVG). Starts at 12 o'clock and fills clockwise. Used
 * for savings-goal progress on Home and in the goals sheet.
 */
export function ProgressRing({ size, stroke, progress, color, trackColor, children }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const half = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={half} cy={half} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={half}
          cy={half}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - p)}
          strokeLinecap="round"
          transform={`rotate(-90 ${half} ${half})`}
        />
      </Svg>
      {children}
    </View>
  );
}
