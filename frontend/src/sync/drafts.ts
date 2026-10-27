const drafts = new Map<string, string>();
export const DRAFT_EVENT = "strength-training-draft";
export function markDraft(exerciseId: string, workoutId: string, dirty: boolean) {
  const wasDirty = drafts.has(exerciseId);
  if (dirty) drafts.set(exerciseId,workoutId); else drafts.delete(exerciseId);
  if (wasDirty && !dirty) window.dispatchEvent(new Event(DRAFT_EVENT));
}
export function protectedWorkouts() { return new Set(drafts.values()); }
