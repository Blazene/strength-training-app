import { exercises } from "./exercises.js";

export class InputError extends Error {}
export type WorkoutInput = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  exercises: { id: string; exerciseId: string; sets: { id: string; weightKg: number; reps: number }[] }[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(value: unknown): value is string { return typeof value === "string" && uuid.test(value); }
function record(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError(`${label} must be an object.`);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) throw new InputError(`${label} contains an unsupported field.`);
  return result;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || Number(value.slice(0, 4)) < 1970) throw new InputError(`${label} must be a UTC ISO timestamp.`);
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0, 19) !== value.slice(0, 19)) throw new InputError(`${label} is not a valid date.`);
  return normalized;
}
export function parseWorkout(value: unknown, pathId: string): WorkoutInput {
  const input = record(value, ["id", "startedAt", "completedAt", "exercises"], "Workout");
  if (!validId(pathId) || !validId(input.id) || input.id.toLowerCase() !== pathId.toLowerCase()) throw new InputError("Workout ID must match the URL UUID.");
  const startedAt = timestamp(input.startedAt, "Start time");
  const completedAt = input.completedAt == null ? null : timestamp(input.completedAt, "Completion time");
  if (completedAt && Date.parse(completedAt) < Date.parse(startedAt)) throw new InputError("Completion cannot precede the start time.");
  if (!Array.isArray(input.exercises) || input.exercises.length > 30) throw new InputError("Provide an exercise list with at most 30 exercises.");
  const ids = new Set([pathId.toLowerCase()]);
  const exerciseIds = new Set<string>();
  function uniqueId(value: unknown): string {
    if (!validId(value) || ids.has(value.toLowerCase())) throw new InputError("Workout items must have distinct UUIDs.");
    ids.add(value.toLowerCase()); return value.toLowerCase();
  }
  const entries = input.exercises.map((value) => {
    const item = record(value, ["id", "exerciseId", "name", "sets"], "Exercise");
    const id = uniqueId(item.id);
    const exercise = exercises.find((entry) => entry.id === item.exerciseId);
    if (!exercise || exerciseIds.has(exercise.id)) throw new InputError("Choose each exercise from the library at most once.");
    exerciseIds.add(exercise.id);
    if (item.name !== undefined && (typeof item.name !== "string" || item.name.length > 120)) throw new InputError("Exercise name must be text up to 120 characters.");
    if (!Array.isArray(item.sets) || item.sets.length > 100) throw new InputError("Provide at most 100 sets per exercise.");
    const sets = item.sets.map((value) => {
      const set = record(value, ["id", "weightKg", "reps"], "Set");
      const id = uniqueId(set.id);
      if (typeof set.weightKg !== "number" || !Number.isFinite(set.weightKg) || set.weightKg < 0) throw new InputError("Weight must be a finite number of 0 or more.");
      if (typeof set.reps !== "number" || !Number.isSafeInteger(set.reps) || set.reps < 1) throw new InputError("Reps must be a positive safe integer.");
      return { id, weightKg: set.weightKg, reps: set.reps };
    });
    if (completedAt && sets.length === 0) throw new InputError("Completed workouts cannot contain exercises without logged sets.");
    return { id, exerciseId: exercise.id, sets };
  });
  if (completedAt && entries.length === 0) throw new InputError("Log at least one set before completing a workout.");
  return { id: pathId.toLowerCase(), startedAt, completedAt, exercises: entries };
}
export function pagination(query: Record<string, unknown>) {
  const integer = (value: unknown, fallback: number, min: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value)) throw new InputError("Pagination values must be integers.");
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new InputError("Pagination is outside the supported range.");
    return parsed;
  };
  return { limit: integer(query.limit, 50, 1, 100), offset: integer(query.offset, 0, 0, 1000000) };
}
