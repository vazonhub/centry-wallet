import { Ionicons } from '@expo/vector-icons';

/**
 * Category / account icons are Ionicons glyph names (B-decision 2026-08-20):
 * emoji rendered as tofu ("?") on device, so we moved to a vector set that
 * renders reliably and tints to the category colour. The `icon` column now
 * stores a glyph name; unknown values (e.g. legacy emoji) fall back to a
 * neutral icon via {@link resolveIcon}.
 */
export type IoniconName = keyof typeof Ionicons.glyphMap;

export const DEFAULT_CATEGORY_ICON: IoniconName = 'pricetag-outline';
export const TRANSFER_ICON: IoniconName = 'swap-horizontal';
export const INCOME_FALLBACK_ICON: IoniconName = 'add-circle-outline';
export const EXPENSE_FALLBACK_ICON: IoniconName = 'remove-circle-outline';

/** Returns a valid Ionicons name, or the default if `name` is unknown/legacy. */
export function resolveIcon(
  name: string | null | undefined,
  fallback: IoniconName = DEFAULT_CATEGORY_ICON,
): IoniconName {
  return name && name in Ionicons.glyphMap ? (name as IoniconName) : fallback;
}

/** Curated set offered in the category editor's icon picker. */
export const CATEGORY_ICON_CHOICES: readonly IoniconName[] = [
  'fast-food-outline',
  'cafe-outline',
  'restaurant-outline',
  'cart-outline',
  'bag-handle-outline',
  'bus-outline',
  'car-outline',
  'airplane-outline',
  'home-outline',
  'flash-outline',
  'medkit-outline',
  'fitness-outline',
  'film-outline',
  'game-controller-outline',
  'gift-outline',
  'shirt-outline',
  'paw-outline',
  'school-outline',
  'book-outline',
  'phone-portrait-outline',
  'repeat-outline',
  'card-outline',
  'cash-outline',
  'wallet-outline',
  'briefcase-outline',
  'trending-up-outline',
  'heart-outline',
  'pricetag-outline',
];

/** Icons for the account-kind picker. */
export const ACCOUNT_KIND_ICONS: Record<'cash' | 'card' | 'wallet', IoniconName> = {
  cash: 'cash-outline',
  card: 'card-outline',
  wallet: 'wallet-outline',
};
