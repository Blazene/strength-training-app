import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { InputError, parseWorkout, validId } from "./validation.js";
import type { WorkoutInput } from "./validation.js";
import { deleteWorkout, lockSyncAccount, replaceWorkout } from "./workouts.js";

export type SyncOperation = {
  accountId: string;
  id: string;
  deviceId: string;
  sequence: number;
  workoutId: string;
  kind: "put" | "delete";
  workout: WorkoutInput | null;
};
export class SyncConflict extends Error {}
export function parseSyncOperation(value: unknown): SyncOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Provide a sync operation.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["accountId", "id", "deviceId", "sequence", "workoutId", "kind", "workout"].includes(key))) throw new InputError("Sync operation contains an unsupported field.");
  if (typeof input.accountId !== "string" || !input.accountId || input.accountId.length > 256) throw new InputError("Provide the expected account ID.");
  if (!validId(input.id) || !validId(input.deviceId) || !validId(input.workoutId)) throw new InputError("Sync IDs must be UUIDs.");
  if (typeof input.sequence !== "number" || !Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new InputError("Sync sequence must be a positive safe integer.");
  if (input.kind !== "put" && input.kind !== "delete") throw new InputError("Unsupported sync action.");
  if (input.kind === "delete" && input.workout != null) throw new InputError("A deletion cannot contain a workout.");
  return { accountId: input.accountId, id: input.id.toLowerCase(), deviceId: input.deviceId.toLowerCase(),
    sequence: input.sequence, workoutId: input.workoutId.toLowerCase(), kind: input.kind,
    workout: input.kind === "put" ? parseWorkout(input.workout, input.workoutId) : null };
}

export async function applySyncOperation(pool: Pool, userId: string, operation: SyncOperation) {
  const hash = createHash("sha256").update(JSON.stringify(operation)).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Low-volume, one-device gym logging: serialize this account's sync writes
    // so receipt reuse and out-of-order requests are unambiguous.
    await lockSyncAccount(client, userId);
    const receipt = (await client.query("SELECT request_hash,outcome FROM sync_operations WHERE user_id=$1 AND operation_id=$2", [userId, operation.id])).rows[0];
    if (receipt) {
      if (receipt.request_hash !== hash) throw new SyncConflict("This operation ID was already used for different data. Your local changes are still saved.");
      await client.query("COMMIT");
      return { accountId: userId, operationId: operation.id, outcome: receipt.outcome as "applied" | "superseded", replayed: true };
    }
    const previous = (await client.query("SELECT device_id,sequence,deleted FROM workout_sync_state WHERE user_id=$1 AND workout_id=$2", [userId, operation.workoutId])).rows[0];
    if (previous && previous.device_id !== operation.deviceId) throw new SyncConflict("This workout is linked to another device. Keep using the original device to sync it.");
    if (previous && Number(previous.sequence) === operation.sequence) throw new SyncConflict("A different operation already used this sequence. Your local changes are still saved.");
    const outcome = previous && Number(previous.sequence) > operation.sequence ? "superseded" : "applied";
    if (outcome === "applied") {
      if (previous?.deleted && operation.kind === "put") throw new SyncConflict("This workout was deleted on the server. Its saved local copy has been kept.");
      if (operation.kind === "put") await replaceWorkout(client, userId, operation.workout!);
      else await deleteWorkout(client, userId, operation.workoutId);
      await client.query(`INSERT INTO workout_sync_state(user_id,workout_id,device_id,sequence,deleted) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(user_id,workout_id) DO UPDATE SET device_id=excluded.device_id,sequence=excluded.sequence,deleted=excluded.deleted,updated_at=now()`,
      [userId, operation.workoutId, operation.deviceId, operation.sequence, operation.kind === "delete"]);
    }
    await client.query(`INSERT INTO sync_operations(user_id,operation_id,request_hash,workout_id,device_id,sequence,outcome) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [userId, operation.id, hash, operation.workoutId, operation.deviceId, operation.sequence, outcome]);
    await client.query("COMMIT");
    return { accountId: userId, operationId: operation.id, outcome, replayed: false };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
