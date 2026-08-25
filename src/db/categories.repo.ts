import type { Category, CategoryKind, Id } from '@models';

import { getDb } from './connection';

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: string;
  is_system: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function mapRow(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    kind: r.kind as CategoryKind,
    isSystem: r.is_system === 1,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export async function createCategory(c: Category): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO categories
       (id, name, icon, color, kind, is_system, sort_order, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      c.id,
      c.name,
      c.icon,
      c.color,
      c.kind,
      c.isSystem ? 1 : 0,
      c.sortOrder,
      c.createdAt,
      c.updatedAt,
      c.deletedAt,
    ],
  );
}

export async function getCategory(id: Id): Promise<Category | null> {
  const db = getDb();
  const row = await db.getFirstAsync<CategoryRow>(`SELECT * FROM categories WHERE id = ?;`, [id]);
  return row ? mapRow(row) : null;
}

export async function listCategories(includeDeleted = false): Promise<Category[]> {
  const db = getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories
     ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'}
     ORDER BY sort_order ASC, created_at ASC;`,
  );
  return rows.map(mapRow);
}

export async function listCategoriesByKind(kind: CategoryKind): Promise<Category[]> {
  const db = getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories WHERE kind = ? AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC;`,
    [kind],
  );
  return rows.map(mapRow);
}

/** Bulk insert used by the seed step; skips rows whose id already exists. */
export async function seedCategories(categories: Category[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const c of categories) {
      await db.runAsync(
        `INSERT OR IGNORE INTO categories
           (id, name, icon, color, kind, is_system, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          c.id,
          c.name,
          c.icon,
          c.color,
          c.kind,
          c.isSystem ? 1 : 0,
          c.sortOrder,
          c.createdAt,
          c.updatedAt,
          c.deletedAt,
        ],
      );
    }
  });
}

export async function updateCategory(
  id: Id,
  fields: { name: string; icon: string; color: string },
  updatedAt: number,
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?;`,
    [fields.name, fields.icon, fields.color, updatedAt, id],
  );
}

export async function softDeleteCategory(id: Id, deletedAt: number): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?;`, [
    deletedAt,
    deletedAt,
    id,
  ]);
}
