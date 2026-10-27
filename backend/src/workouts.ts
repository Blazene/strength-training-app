import type { Pool, PoolClient } from "pg";
import type { WorkoutInput } from "./validation.js";

type Database = Pool | PoolClient;
export class WorkoutConflict extends Error {}
export async function lockSyncAccount(client: PoolClient, userId: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`strength-sync:${userId}`]);
}
async function directWriteAllowed(client: PoolClient, userId: string, id: string) {
  await lockSyncAccount(client, userId);
  if ((await client.query("SELECT 1 FROM workout_sync_state WHERE user_id=$1 AND workout_id=$2", [userId, id])).rowCount) {
    throw new WorkoutConflict("Use the sync endpoint to change this synced workout. Pending changes and deletion records must be preserved.");
  }
}
export async function getWorkout(db: Database, userId: string, id: string) {
  const result = await db.query(`
    SELECT w.id, w.started_at, w.completed_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', we.id, 'exerciseId', we.exercise_id, 'name', e.name,
        'sets', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'weightKg', s.weight_kg, 'reps', s.reps) ORDER BY s.position)
          FROM workout_sets s WHERE s.user_id = we.user_id AND s.workout_exercise_id = we.id), '[]'::jsonb)
      ) ORDER BY we.position) FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
        WHERE we.user_id = w.user_id AND we.workout_id = w.id), '[]'::jsonb) AS exercises
    FROM workouts w WHERE w.user_id = $1 AND w.id = $2`, [userId, id]);
  const row = result.rows[0];
  return row ? { id: row.id as string, startedAt: (row.started_at as Date).toISOString(),
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null, exercises: row.exercises } : null;
}
export async function listWorkouts(db: Database, userId: string, limit: number, offset: number) {
  const result = await db.query(`SELECT w.id, w.started_at, w.completed_at,
    (SELECT count(*)::int FROM workout_exercises we WHERE we.user_id=w.user_id AND we.workout_id=w.id) AS exercise_count,
    (SELECT count(*)::int FROM workout_sets s JOIN workout_exercises we ON we.user_id=s.user_id AND we.id=s.workout_exercise_id
      WHERE we.user_id=w.user_id AND we.workout_id=w.id) AS set_count
    FROM workouts w WHERE w.user_id=$1 ORDER BY w.started_at DESC, w.id DESC LIMIT $2 OFFSET $3`, [userId, limit + 1, offset]);
  return {
    workouts: result.rows.slice(0, limit).map((row) => ({ id: row.id, startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null, exerciseCount: row.exercise_count, setCount: row.set_count })),
    nextOffset: result.rows.length > limit ? offset + limit : null
  };
}
// Shared by direct writes and sync so child replacement and its receipt can
// commit in the same database transaction.
export async function replaceWorkout(client: PoolClient, userId: string, workout: WorkoutInput) {
  await client.query(`INSERT INTO workouts(user_id,id,started_at,completed_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id,id) DO UPDATE SET started_at=excluded.started_at,completed_at=excluded.completed_at,updated_at=now()`,
  [userId, workout.id, workout.startedAt, workout.completedAt]);
  await client.query("DELETE FROM workout_exercises WHERE user_id=$1 AND workout_id=$2", [userId, workout.id]);
  const entries = workout.exercises.map((exercise, position) => ({ id: exercise.id, exercise_id: exercise.exerciseId, position }));
  if (entries.length) await client.query(`INSERT INTO workout_exercises(user_id,id,workout_id,exercise_id,position)
    SELECT $1,x.id,$2,x.exercise_id,x.position FROM jsonb_to_recordset($3::jsonb) AS x(id uuid,exercise_id text,position int)`,
  [userId, workout.id, JSON.stringify(entries)]);
  const sets = workout.exercises.flatMap((exercise) => exercise.sets.map((set, position) => ({
    id: set.id, workout_exercise_id: exercise.id, position, weight_kg: set.weightKg, reps: set.reps
  })));
  if (sets.length) await client.query(`INSERT INTO workout_sets(user_id,id,workout_exercise_id,position,weight_kg,reps)
    SELECT $1,x.id,x.workout_exercise_id,x.position,x.weight_kg,x.reps
    FROM jsonb_to_recordset($2::jsonb) AS x(id uuid,workout_exercise_id uuid,position int,weight_kg numeric,reps bigint)`, [userId, JSON.stringify(sets)]);
  return getWorkout(client, userId, workout.id);
}
export async function putWorkout(pool: Pool, userId: string, workout: WorkoutInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await directWriteAllowed(client, userId, workout.id);
    const saved = await replaceWorkout(client, userId, workout);
    await client.query("COMMIT");
    return saved;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function deleteWorkout(db: Database, userId: string, id: string) {
  const result = await db.query("DELETE FROM workouts WHERE user_id=$1 AND id=$2", [userId, id]);
  return result.rowCount === 1;
}

export async function deleteDirectWorkout(pool: Pool, userId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await directWriteAllowed(client, userId, id);
    const removed = await deleteWorkout(client, userId, id);
    await client.query("COMMIT");
    return removed;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
