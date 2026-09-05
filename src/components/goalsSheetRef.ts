import { createRef } from 'react';

/**
 * Imperative handle to the single global goals sheet, rendered once at the app
 * root. Home opens it from the goal-rings row via {@link openGoalsSheet}.
 */
export interface GoalsSheetHandle {
  /** Opens the sheet; pass a goalId to jump straight to that goal's actions. */
  open(goalId?: string): void;
}

export const goalsSheetRef = createRef<GoalsSheetHandle>();

/** Opens the goals sheet, retrying a few frames if the ref isn't mounted yet. */
export function openGoalsSheet(goalId?: string): void {
  let attempts = 0;
  const tryOpen = (): void => {
    if (goalsSheetRef.current) {
      goalsSheetRef.current.open(goalId);
      return;
    }
    if (attempts++ < 30) {
      requestAnimationFrame(tryOpen);
      return;
    }
    console.warn('[goals] sheet ref not ready');
  };
  tryOpen();
}
