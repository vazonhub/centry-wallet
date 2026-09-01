import { CategoriesRepo } from '@db';
import type { Category, CategoryKind, Id } from '@models';
import { nowSec } from '@utils/date';
import { uuid } from '@utils/uuid';

import { DataController } from './data.controller';

export interface CreateCategoryInput {
  name: string;
  icon: string;
  color: string;
  kind: CategoryKind;
}

/** Creates a user category (non-system) and refreshes the store. */
async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const now = nowSec();
  const existing = await CategoriesRepo.listCategories(true);
  const category: Category = {
    id: uuid(),
    name: input.name.trim() || 'Категория',
    icon: input.icon,
    color: input.color,
    kind: input.kind,
    isSystem: false,
    sortOrder: existing.length,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await CategoriesRepo.createCategory(category);
  await DataController.loadAll();
  return category;
}

/** Edits a category's name / icon / colour (allowed for system categories too). */
async function updateCategory(
  id: Id,
  fields: { name: string; icon: string; color: string },
): Promise<void> {
  await CategoriesRepo.updateCategory(
    id,
    { ...fields, name: fields.name.trim() || 'Категория' },
    nowSec(),
  );
  await DataController.loadAll();
}

/** Soft-deletes a category (rule 10). Its entries keep their frozen data. */
async function deleteCategory(id: Id): Promise<void> {
  await CategoriesRepo.softDeleteCategory(id, nowSec());
  await DataController.loadAll();
}

/**
 * Persists a user-defined category order (drag-and-drop in settings). `orderedIds`
 * is one kind's visible order; `sort_order` is rewritten to match, then the store
 * refreshes through the single funnel.
 */
async function reorderCategories(orderedIds: Id[]): Promise<void> {
  await CategoriesRepo.reorderCategories(orderedIds, nowSec());
  await DataController.loadAll();
}

export const CategoriesController = {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
