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

/** Soft-deletes a user category (rule 10). System categories are not deletable. */
async function deleteCategory(id: Id): Promise<void> {
  await CategoriesRepo.softDeleteCategory(id, nowSec());
  await DataController.loadAll();
}

export const CategoriesController = { createCategory, updateCategory, deleteCategory };
