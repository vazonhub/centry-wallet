import { createRef } from 'react';

import type { Category, CategoryKind } from '@models';

/** Open the editor to edit an existing category, or to create one of a kind. */
export type CategoryEditorTarget = Category | { kind: CategoryKind };

export interface CategoryEditorHandle {
  open(target: CategoryEditorTarget): void;
}

/**
 * Module-level ref to the single category editor sheet, rendered once at the app
 * root. Any screen opens it via {@link openCategoryEditor} — the input sheet's
 * "add category" button and the settings category list both use it.
 */
export const categoryEditorRef = createRef<CategoryEditorHandle>();

export function openCategoryEditor(target: CategoryEditorTarget): void {
  categoryEditorRef.current?.open(target);
}
