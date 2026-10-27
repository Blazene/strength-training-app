import type { CompletedWorkout, Workout } from "../types/workout";
import type { WorkoutState } from "../storage/workouts";
import type { PendingOperation, RemoteWorkout, SyncMetadata, WorkoutSnapshot } from "./model.ts";
import { latestOperations } from "./model.ts";

export function allWorkouts(state: WorkoutState): WorkoutSnapshot[] {
  return [state.active, ...(state.otherActive ?? []), ...state.history].filter((workout): workout is Workout | CompletedWorkout => workout !== null)
    .map(workout => ({ ...workout, completedAt: "completedAt" in workout ? workout.completedAt : null }));
}
export function snapshotText(workout: WorkoutSnapshot | null) { return workout ? JSON.stringify(workout) : null; }
function comparable(workout: WorkoutSnapshot | null) {
  return workout ? JSON.stringify({ id: workout.id, startedAt: workout.startedAt, completedAt: workout.completedAt,
    exercises: workout.exercises.map(exercise=>({ id: exercise.id, exerciseId: exercise.exerciseId, name: exercise.name,
      sets: exercise.sets.map(set=>({ id: set.id, weightKg: set.weightKg, reps: set.reps })) })) }) : null;
}
export function arrangeWorkouts(previous: WorkoutState, workouts: Map<string, WorkoutSnapshot>, preferred = previous.active?.id): WorkoutState {
  const active = [...workouts.values()].filter(workout=>!workout.completedAt).sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt) || a.id.localeCompare(b.id));
  const chosen = active.find(workout=>workout.id===preferred) ?? active[0] ?? null;
  const unfinished = (workout: WorkoutSnapshot): Workout => ({ id: workout.id, startedAt: workout.startedAt, exercises: workout.exercises });
  return { ...previous, active: chosen ? unfinished(chosen) : null,
    otherActive: active.filter(workout=>workout.id!==chosen?.id).map(unfinished),
    history: [...workouts.values()].filter((workout): workout is CompletedWorkout=>workout.completedAt!==null)
      .sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt) || a.id.localeCompare(b.id)) };
}
function stateText(state: WorkoutState) {
  return JSON.stringify({ active: state.active?.id ?? null, workouts: allWorkouts(state).sort((a,b)=>a.id.localeCompare(b.id)).map(comparable) });
}
export function mergeRemote(previous: WorkoutState, originalMetadata: SyncMetadata, pending: PendingOperation[], entries: RemoteWorkout[], protectedIds: Set<string>) {
  const metadata: SyncMetadata = { ...originalMetadata, snapshots: { ...originalMetadata.snapshots }, serverVersions: { ...originalMetadata.serverVersions }, conflicts: { ...originalMetadata.conflicts }, deferred: [] };
  const workouts = new Map(allWorkouts(previous).map(workout=>[workout.id,workout]));
  const latest = new Map(latestOperations(pending).map(operation=>[operation.workoutId,operation]));
  const accepted = new Set<string>();
  for (const entry of entries) {
    const known = metadata.serverVersions![entry.id] ?? 0;
    if (entry.version < known) continue;
    const local = workouts.get(entry.id) ?? null;
    const operation = latest.get(entry.id);
    if (operation) {
      const base = operation.baseVersion ?? known;
      const conflict = (entry.deleted && operation.kind !== "delete") ||
        (!entry.deleted && entry.version > base && entry.deviceId !== metadata.deviceId) ||
        (entry.deviceId === metadata.deviceId && entry.sequence > operation.sequence && comparable(local) !== comparable(entry.workout));
      if (conflict) metadata.conflicts![entry.id] = entry;
      else delete metadata.conflicts![entry.id];
      // A pull cannot remove or replace pending local edits. Only their receipt,
      // or an explicit keep-both resolution, can retire those operations.
      continue;
    }
    if (protectedIds.has(entry.id) && comparable(local) !== comparable(entry.workout)) {
      metadata.deferred!.push(entry.id); continue;
    }
    delete metadata.conflicts![entry.id];
    if (entry.deleted) workouts.delete(entry.id);
    else workouts.set(entry.id, entry.workout!);
    metadata.serverVersions![entry.id] = entry.version;
    accepted.add(entry.id);
  }
  const arranged = arrangeWorkouts(previous, workouts);
  const changed = stateText(previous) !== stateText(arranged);
  const state = changed ? { ...arranged, revision: previous.revision + 1 } : previous;
  const actual = new Map(allWorkouts(state).map(workout=>[workout.id,workout]));
  for (const id of accepted) metadata.snapshots[id] = snapshotText(actual.get(id) ?? null);
  return { state, metadata, changed };
}
