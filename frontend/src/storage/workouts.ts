import type { CompletedWorkout, Workout } from "../types/workout";

export type WorkoutState = {
  revision: number;
  active: Workout | null;
  history: CompletedWorkout[];
};

const DATABASE = "strength-training";
const STORE = "workouts";
const KEY = "state";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Close other training tabs and try again."));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

function isWorkout(value: unknown): value is Workout {
  if (typeof value !== "object" || value === null) return false;
  const workout = value as Workout;
  return typeof workout.id === "string"
    && typeof workout.startedAt === "string" && Number.isFinite(Date.parse(workout.startedAt))
    && Array.isArray(workout.exercises)
    && workout.exercises.every((exercise) =>
      exercise !== null && typeof exercise === "object"
      && typeof exercise.id === "string"
      && typeof exercise.exerciseId === "string"
      && typeof exercise.name === "string"
      && Array.isArray(exercise.sets)
      && exercise.sets.every((set) =>
        set !== null && typeof set === "object"
        && typeof set.id === "string"
        && Number.isFinite(set.weightKg) && set.weightKg >= 0
        && Number.isSafeInteger(set.reps) && set.reps > 0
      )
    );
}

function isState(value: unknown): value is WorkoutState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as WorkoutState;
  return Number.isSafeInteger(state.revision) && state.revision >= 0
    && (state.active === null || isWorkout(state.active))
    && Array.isArray(state.history)
    && state.history.every((workout) =>
      isWorkout(workout) && typeof workout.completedAt === "string"
      && Number.isFinite(Date.parse(workout.completedAt))
    );
}

export async function loadWorkouts(): Promise<WorkoutState> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(KEY);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const result: unknown = request.result;
        if (result === undefined) resolve({ revision: 0, active: null, history: [] });
        else if (isState(result)) resolve(result);
        else reject(new Error("Saved workout data could not be read. Nothing has been overwritten."));
      };
    });
  } finally {
    db.close();
  }
}

export async function saveWorkouts(state: WorkoutState): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      let conflict: Error | null = null;
      transaction.onabort = () => reject(conflict ?? transaction.error);
      transaction.onerror = () => reject(transaction.error);
      // Only report success once the transaction commits, not when put succeeds.
      transaction.oncomplete = () => resolve();
      const store = transaction.objectStore(STORE);
      const request = store.get(KEY);
      request.onsuccess = () => {
        const previous: unknown = request.result;
        const revision = previous === undefined ? 0 : isState(previous) ? previous.revision : -1;
        if (revision !== state.revision - 1) {
          conflict = new Error("Saved data changed in another tab. Reload to load the latest workouts before trying again.");
          transaction.abort();
          return;
        }
        store.put(state, KEY);
      };
    });
  } finally {
    db.close();
  }
}
