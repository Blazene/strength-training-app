import type { Workout } from "../types/workout";
import type { AccountUser } from "../utils/accountApi";

export type WorkoutSnapshot = Workout & { completedAt: string | null };
export type PendingOperation = {
  id: string;
  ownerId: string | null;
  deviceId: string;
  sequence: number;
  workoutId: string;
  kind: "put" | "delete";
  workout: WorkoutSnapshot | null;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  blocked: boolean;
  error: string;
};
export type SyncMetadata = {
  version: 1;
  owner: AccountUser | null;
  deviceId: string;
  nextSequence: number;
  // Exact serialized snapshots avoid hash collisions and detect writes by an
  // older app tab that does not yet know about the queue.
  snapshots: Record<string, string | null>;
  lastSyncedAt: string | null;
};
export type StoredSync = { metadata: SyncMetadata; pending: PendingOperation[] };

export function latestOperations(pending: PendingOperation[]) {
  const latest = new Map<string, PendingOperation>();
  for (const operation of pending) {
    const previous = latest.get(operation.workoutId);
    if (!previous || previous.sequence < operation.sequence) latest.set(operation.workoutId, operation);
  }
  return [...latest.values()].sort((left, right) => left.sequence - right.sequence);
}
export function retryDelay(attempts: number, random = Math.random()) {
  return Math.min(60000, 1000 * 2 ** Math.min(6, Math.max(0, attempts - 1))) + Math.floor(random * 500);
}
export function isAccountUser(value: unknown): value is AccountUser {
  if (!value || typeof value !== "object") return false;
  const user = value as AccountUser;
  return typeof user.id === "string" && !!user.id && typeof user.name === "string" && typeof user.email === "string";
}
