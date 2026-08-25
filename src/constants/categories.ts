import type { Category, EpochSeconds } from '@models';

/**
 * System category seeds (D13, docs/UX_SPEC.md#стартовые-данные): 8 expense + 3
 * income categories, all `is_system`. A category editor arrives in v1.0.
 * Income can also stay uncategorised (`category_id` is nullable). Colours are
 * decorative only; they never encode +/− (rule 6). IDs are stable so re-seeding
 * is idempotent (the repo inserts with OR IGNORE).
 */
interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: Category['kind'];
}

// Icons are Ionicons glyph names (see @constants/icons); rendered via <AppIcon>.
// Seed names are English (the base language since 2026-08-25); they still
// display-localize by stable id via @utils/displayName.
const EXPENSE_DEFS: readonly CategoryDef[] = [
  { id: 'cat-food', name: 'Food', icon: 'fast-food-outline', color: '#F08A24', kind: 'expense' },
  {
    id: 'cat-transport',
    name: 'Transport',
    icon: 'bus-outline',
    color: '#32ADE6',
    kind: 'expense',
  },
  { id: 'cat-cafe', name: 'Café', icon: 'cafe-outline', color: '#A2845E', kind: 'expense' },
  { id: 'cat-home', name: 'Home', icon: 'home-outline', color: '#8E5CD9', kind: 'expense' },
  { id: 'cat-health', name: 'Health', icon: 'medkit-outline', color: '#FF6961', kind: 'expense' },
  { id: 'cat-leisure', name: 'Leisure', icon: 'film-outline', color: '#5856D6', kind: 'expense' },
  {
    id: 'cat-subs',
    name: 'Subscriptions',
    icon: 'repeat-outline',
    color: '#E91E63',
    kind: 'expense',
  },
  {
    id: 'cat-other-exp',
    name: 'Other',
    icon: 'pricetag-outline',
    color: '#9AA1AD',
    kind: 'expense',
  },
];

const INCOME_DEFS: readonly CategoryDef[] = [
  { id: 'cat-salary', name: 'Salary', icon: 'cash-outline', color: '#0F7A4F', kind: 'income' },
  { id: 'cat-payouts', name: 'Payouts', icon: 'card-outline', color: '#0A84FF', kind: 'income' },
  {
    id: 'cat-transfers-in',
    name: 'Transfers',
    icon: 'swap-horizontal-outline',
    color: '#00C7BE',
    kind: 'income',
  },
];

/**
 * System-category seed id → its current (English) seed name. Used by
 * `@utils/displayName` to tell an untouched system category (localizable) from
 * one the user has renamed (keeps its stored name).
 */
export const SEED_CATEGORY_NAMES: Record<string, string> = Object.fromEntries(
  [...EXPENSE_DEFS, ...INCOME_DEFS].map((d) => [d.id, d.name]),
);

/**
 * Original Russian seed names (pre-2026-08-25, when RU was the base language).
 * Still recognized by `@utils/displayName` so untouched seed categories on
 * older installs keep localizing after the switch to English seeds — no DB
 * migration needed.
 */
export const LEGACY_SEED_CATEGORY_NAMES: Record<string, string> = {
  'cat-food': 'Еда',
  'cat-transport': 'Транспорт',
  'cat-cafe': 'Кафе',
  'cat-home': 'Дом',
  'cat-health': 'Здоровье',
  'cat-leisure': 'Досуг',
  'cat-subs': 'Подписки',
  'cat-other-exp': 'Другое',
  'cat-salary': 'Зарплата',
  'cat-payouts': 'Выплаты',
  'cat-transfers-in': 'Переводы',
};

/** Curated colours offered in the category editor's colour picker (decorative, rule 6). */
export const CATEGORY_COLOR_CHOICES: readonly string[] = [
  '#F08A24',
  '#FF6961',
  '#E91E63',
  '#8E5CD9',
  '#5856D6',
  '#0A84FF',
  '#32ADE6',
  '#00C7BE',
  '#0F7A4F',
  '#A2845E',
  '#9AA1AD',
  '#14161B',
];

/** Builds the full system-category list stamped with `now` (epoch seconds). */
export function buildSeedCategories(now: EpochSeconds): Category[] {
  return [...EXPENSE_DEFS, ...INCOME_DEFS].map((def, index) => ({
    id: def.id,
    name: def.name,
    icon: def.icon,
    color: def.color,
    kind: def.kind,
    isSystem: true,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
}
