import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { InputError, parseWorkout, validId } from "./validation.js";
import type { WorkoutInput } from "./validation.js";
import { deleteWorkout, getWorkouts, lockSyncAccount, replaceWorkout } from "./workouts.js";

export type SyncOperation = {
  accountId: string;
  id: string;
  deviceId: string;
  sequence: number;
  workoutId: string;
  kind: "put" | "delete";
  workout: WorkoutInput | null;
  baseVersion?: number;
};
export class SyncConflict extends Error {}
export function parseSyncOperation(value: unknown): SyncOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("Provide a sync operation.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["accountId", "id", "deviceId", "sequence", "workoutId", "kind", "workout", "baseVersion"].includes(key))) throw new InputError("Sync operation contains an unsupported field.");
  if (typeof input.accountId !== "string" || !input.accountId || input.accountId.length > 256) throw new InputError("Provide the expected account ID.");
  if (!validId(input.id) || !validId(input.deviceId) || !validId(input.workoutId)) throw new InputError("Sync IDs must be UUIDs.");
  if (typeof input.sequence !== "number" || !Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new InputError("Sync sequence must be a positive safe integer.");
  if (input.kind !== "put" && input.kind !== "delete") throw new InputError("Unsupported sync action.");
  if (input.kind === "delete" && input.workout != null) throw new InputError("A deletion cannot contain a workout.");
  if (input.baseVersion !== undefined && (typeof input.baseVersion !== "number" || !Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0)) throw new InputError("Base version must be a non-negative safe integer.");
  return { accountId: input.accountId, id: input.id.toLowerCase(), deviceId: input.deviceId.toLowerCase(),
    sequence: input.sequence, workoutId: input.workoutId.toLowerCase(), kind: input.kind,
    workout: input.kind === "put" ? parseWorkout(input.workout, input.workoutId) : null,
    ...(input.baseVersion === undefined ? {} : { baseVersion: input.baseVersion as number }) };
}

export async function applySyncOperation(pool: Pool, userId: string, operation: SyncOperation, currentProtocol: boolean) {
  const hash = createHash("sha256").update(JSON.stringify(operation)).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Low-volume, one-device gym logging: serialize this account's sync writes
    // so receipt reuse and out-of-order requests are unambiguous.
    await lockSyncAccount(client, userId);
    const receipt = (await client.query("SELECT request_hash,outcome,version FROM sync_operations WHERE user_id=$1 AND operation_id=$2", [userId, operation.id])).rows[0];
    if (receipt) {
      if (receipt.request_hash !== hash) throw new SyncConflict("This operation ID was already used for different data. Your local changes are still saved.");
      await client.query("COMMIT");
      return { accountId: userId, operationId: operation.id, outcome: receipt.outcome as "applied" | "superseded", replayed: true, version: receipt.version === null ? null : Number(receipt.version) };
    }
    // Old tabs do not understand additional unfinished sessions and can infer
    // spurious deletions. Recorded retries above remain safe; new writes need
    // the current client. The header is a compatibility gate, not authentication.
    if (!currentProtocol) throw new SyncConflict("Update Strength Training before uploading new changes. Your saved changes are kept on this device.");
    const previous = (await client.query("SELECT device_id,sequence,deleted,version FROM workout_sync_state WHERE user_id=$1 AND workout_id=$2", [userId, operation.workoutId])).rows[0];
    const version = previous ? Number(previous.version) : 0;
    const sameDevice = previous?.device_id === operation.deviceId;
    // Deleting something already deleted is safe on any device, without taking
    // ownership or changing its version. All other handoffs require a fresh pull.
    const alreadyDeleted = previous?.deleted && operation.kind === "delete";
    if (!alreadyDeleted && previous?.device_id && !sameDevice && operation.baseVersion !== version) {
      throw new SyncConflict("This workout changed on another device. Download the latest version before syncing; your local copy is kept.");
    }
    if (!alreadyDeleted && operation.baseVersion !== undefined && (operation.baseVersion > version || (!sameDevice && operation.baseVersion !== version))) {
      throw new SyncConflict("The server workout changed since this device last checked. Your local changes are kept.");
    }
    if (!alreadyDeleted && sameDevice && Number(previous.sequence) === operation.sequence) throw new SyncConflict("A different operation already used this sequence. Your local changes are still saved.");
    const outcome = alreadyDeleted || (sameDevice && Number(previous.sequence) > operation.sequence) ? "superseded" : "applied";
    let acknowledgedVersion = version;
    if (outcome === "applied") {
      if (previous?.deleted && operation.kind === "put") throw new SyncConflict("This workout was deleted on the server. Its saved local copy has been kept.");
      if (operation.kind === "put") await replaceWorkout(client, userId, operation.workout!);
      else await deleteWorkout(client, userId, operation.workoutId);
      acknowledgedVersion = version + 1;
      await client.query(`INSERT INTO workout_sync_state(user_id,workout_id,device_id,sequence,deleted,version) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(user_id,workout_id) DO UPDATE SET device_id=excluded.device_id,sequence=excluded.sequence,deleted=excluded.deleted,version=excluded.version,updated_at=now()`,
      [userId, operation.workoutId, operation.deviceId, operation.sequence, operation.kind === "delete", acknowledgedVersion]);
    }
    await client.query(`INSERT INTO sync_operations(user_id,operation_id,request_hash,workout_id,device_id,sequence,outcome,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId, operation.id, hash, operation.workoutId, operation.deviceId, operation.sequence, outcome, acknowledgedVersion]);
    await client.query("COMMIT");
    return { accountId: userId, operationId: operation.id, outcome, replayed: false, version: acknowledgedVersion };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}


export async function downloadWorkouts(pool: Pool, userId: string, cursor: string | null, limit: number) {
  const client = await pool.connect();
  try {
    // Each page's versions, tombstones, and nested sets share one DB snapshot.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await client.query(`SELECT workout_id,device_id,sequence,deleted,version FROM workout_sync_state
      WHERE user_id=$1 AND ($2::uuid IS NULL OR workout_id>$2::uuid) ORDER BY workout_id LIMIT $3`, [userId,cursor,limit+1]);
    const rows = result.rows.slice(0,limit);
    const workouts = new Map((await getWorkouts(client,userId,rows.filter(row=>!row.deleted).map(row=>row.workout_id))).map(workout=>[workout.id,workout]));
    const entries = rows.map(row=>({ id: row.workout_id as string, deviceId: row.device_id as string|null,
      sequence: Number(row.sequence), version: Number(row.version), deleted: row.deleted as boolean,
      workout: row.deleted ? null : workouts.get(row.workout_id) }));
    if (entries.some(entry=>!entry.deleted && !entry.workout)) throw new Error("A workout snapshot is incomplete.");
    await client.query("COMMIT");
    return { accountId: userId, entries, nextCursor: result.rows.length>limit ? rows.at(-1)!.workout_id as string : null };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
