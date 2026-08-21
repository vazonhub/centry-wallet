import { Ionicons } from '@expo/vector-icons';

import { resolveIcon, type IoniconName } from '@constants/icons';

interface Props {
  /** Ionicons glyph name (legacy emoji values fall back to a neutral icon). */
  name: string | null | undefined;
  color: string;
  size?: number;
  /** Fallback glyph when `name` is unknown. */
  fallback?: IoniconName;
}

/**
 * The one way category/account icons reach the screen. Wraps Ionicons with a
 * safe fallback so a legacy/emoji `icon` value never renders as tofu ("?").
 */
export function AppIcon({ name, color, size = 22, fallback }: Props) {
  return <Ionicons name={resolveIcon(name, fallback)} size={size} color={color} />;
}
