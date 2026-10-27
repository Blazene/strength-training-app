import type { AccountUser } from "../utils/accountApi";
import { allWorkouts, arrangeWorkouts, mergeRemote, snapshotText } from "../sync/merge";
import { isRemoteWorkout } from "../sync/network";
import { protectedWorkouts } from "../sync/drafts";
import { isAccountUser } from "../sync/model";
import type { PendingOperation, RemoteWorkout, StoredSync, SyncMetadata, WorkoutSnapshot } from "../sync/model";
import { isState, KEY, openDatabase, STORE } from "./workouts";
import type { WorkoutState } from "./workouts";

const META = "sync:metadata";
const PREFIX = "sync:pending:";
export const STORAGE_EVENT = "strength-training-storage";
export const STORAGE_SIGNAL = "strength-training-change";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const empty = (): WorkoutState => ({ revision: 0, active: null, history: [] });
const pendingRange = () => IDBKeyRange.bound(PREFIX, PREFIX + "\uffff");

function notify(reason: "local" | "remote" | "ack" = "local") {
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: reason }));
  try { localStorage.setItem(STORAGE_SIGNAL, JSON.stringify({ id: crypto.randomUUID(), reason })); } catch { /* Same-tab syncing still works if localStorage is unavailable. */ }
}
function metadata(value: unknown): SyncMetadata {
  if (value === undefined) return { version: 1, owner: null, deviceId: crypto.randomUUID(), nextSequence: 0, snapshots: {}, lastSyncedAt: null };
  const result = value as SyncMetadata;
  if (!result || result.version !== 1 || !(result.owner === null || isAccountUser(result.owner))
    || !uuid.test(result.deviceId) || !Number.isSafeInteger(result.nextSequence) || result.nextSequence < 0
    || !result.snapshots || typeof result.snapshots !== "object" || Array.isArray(result.snapshots)
    || !Object.entries(result.snapshots).every(([key, value]) => uuid.test(key) && (value === null || typeof value === "string"))
    || !(result.lastSyncedAt === null || (typeof result.lastSyncedAt === "string" && Number.isFinite(Date.parse(result.lastSyncedAt))))) {
    throw new Error("Saved sync information could not be read. Your workouts have not been overwritten.");
  }
  result.serverVersions ??= {};
  result.conflicts ??= {};
  result.deferred ??= [];
  if (!result.conflicts || typeof result.conflicts!=="object" || Array.isArray(result.conflicts)
    || !Object.entries(result.conflicts).every(([id,value])=>id===value?.id && isRemoteWorkout(value))
    || !Array.isArray(result.deferred) || !result.deferred.every(id=>uuid.test(id))) throw new Error("Saved download information could not be read. Your workouts were kept.");
  if (!Object.entries(result.serverVersions).every(([id,value])=>uuid.test(id) && Number.isSafeInteger(value) && value>=0)) throw new Error("Saved server versions could not be read.");
  return result;
}
function pending(value: unknown, meta: SyncMetadata): PendingOperation[] {
  if (!Array.isArray(value)) throw new Error("Saved changes could not be read.");
  for (const operation of value as PendingOperation[]) {
    if (!operation || !uuid.test(operation.id) || operation.deviceId !== meta.deviceId || operation.ownerId !== (meta.owner?.id ?? null)
      || !Number.isSafeInteger(operation.sequence) || operation.sequence < 1 || operation.sequence > meta.nextSequence
      || !uuid.test(operation.workoutId) || !["put", "delete"].includes(operation.kind)
      || (operation.kind === "delete" ? operation.workout !== null : operation.workout?.id !== operation.workoutId)
      || !(operation.baseVersion===undefined || Number.isSafeInteger(operation.baseVersion) && operation.baseVersion>=0)
      || !Number.isSafeInteger(operation.attempts) || operation.attempts < 0 || !Number.isFinite(operation.nextAttemptAt)) {
      throw new Error("Saved changes could not be read safely. Your workouts are still on this device.");
    }
  }
  return (value as PendingOperation[]).sort((a, b) => a.sequence - b.sequence);
}

// No fetches or other async work run inside an IndexedDB transaction. All
// follow-up requests are scheduled from request callbacks; success means commit.
async function transaction<T>(work: (store: IDBObjectStore, done: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      let result: T; let failure: unknown;
      const fail = (error: unknown) => { failure = error; tx.abort(); };
      tx.onabort = () => reject(failure ?? tx.error);
      tx.onerror = () => reject(failure ?? tx.error);
      tx.oncomplete = () => resolve(result);
      try { work(tx.objectStore(STORE), value => { result = value; }, fail); } catch (error) { fail(error); }
    });
  } finally { db.close(); }
}
function read(store: IDBObjectStore, fail: (error: unknown) => void, callback: (state: WorkoutState, meta: SyncMetadata) => void) {
  const stateRequest = store.get(KEY);
  stateRequest.onsuccess = () => {
    const state: unknown = stateRequest.result;
    if (state !== undefined && !isState(state)) { fail(new Error("Saved workouts could not be read. Nothing was overwritten.")); return; }
    const metaRequest = store.get(META);
    metaRequest.onsuccess = () => {
      try { callback(state === undefined ? empty() : state as WorkoutState, metadata(metaRequest.result)); }
      catch (error) { fail(error); }
    };
  };
}
function enqueue(store: IDBObjectStore, meta: SyncMetadata, state: WorkoutState) {
  const snapshots = new Map<string, WorkoutSnapshot>();
  for (const workout of allWorkouts(state)) {
    if (snapshots.has(workout.id)) throw new Error("Saved workouts have duplicate IDs. Nothing was overwritten.");
    snapshots.set(workout.id,workout);
  }
  for (const id of new Set([...Object.keys(meta.snapshots), ...snapshots.keys()])) {
    const workout = snapshots.get(id) ?? null;
    const serialized = workout ? JSON.stringify(workout) : null;
    if (meta.snapshots[id] === serialized) continue;
    if (!Number.isSafeInteger(meta.nextSequence + 1)) throw new Error("The sync sequence is exhausted. Your last saved workout is unchanged.");
    const operation: PendingOperation = { id: crypto.randomUUID(), ownerId: meta.owner?.id ?? null,
      deviceId: meta.deviceId, sequence: ++meta.nextSequence, workoutId: id,
      kind: workout ? "put" : "delete", workout, baseVersion: meta.serverVersions?.[id] ?? 0, createdAt: new Date().toISOString(),
      attempts: 0, nextAttemptAt: 0, blocked: false, error: "" };
    store.put(operation, PREFIX + operation.id);
    meta.snapshots[id] = serialized;
  }
}

export async function saveWorkouts(state: WorkoutState): Promise<void> {
  await transaction<void>((store, done, fail) => read(store, fail, (previous, meta) => {
    if (previous.revision !== state.revision - 1) throw new Error("Saved data changed in another tab. Reload to load the latest workouts before trying again.");
    enqueue(store, meta, previous);
    enqueue(store, meta, state);
    store.put(state, KEY);
    store.put(meta, META);
    done();
  }));
  notify();
}
export async function readSyncState(): Promise<StoredSync> {
  return transaction<StoredSync>((store, done, fail) => read(store, fail, (state, meta) => {
    enqueue(store, meta, state);
    store.put(meta, META);
    const request = store.getAll(pendingRange());
    request.onsuccess = () => { try { done({ metadata: meta, pending: pending(request.result, meta) }); } catch (error) { fail(error); } };
  }));
}
export async function bindSyncAccount(user: AccountUser): Promise<void> {
  if (!isAccountUser(user)) throw new Error("Sign in before enabling sync.");
  await transaction<void>((store, done, fail) => read(store, fail, (state, meta) => {
    if (meta.owner && meta.owner.id !== user.id) throw new Error(`These workouts are linked to ${meta.owner.email}. Sign back in to that account to sync.`);
    enqueue(store, meta, state);
    const request = store.getAll(pendingRange());
    request.onsuccess = () => {
      try {
        for (const operation of pending(request.result, meta)) store.put({ ...operation, ownerId: user.id }, PREFIX + operation.id);
        meta.owner = user; store.put(meta, META); done();
      } catch (error) { fail(error); }
    };
  }));
  notify();
}
export async function acknowledge(operation: PendingOperation, version: number | null = null): Promise<void> {
  await transaction<void>((store, done, fail) => read(store, fail, (state, meta) => {
    enqueue(store, meta, state);
    if (!operation.ownerId || meta.owner?.id !== operation.ownerId || meta.deviceId !== operation.deviceId) throw new Error("The sync account changed. Saved changes were kept.");
    const request = store.getAll(pendingRange());
    request.onsuccess = () => {
      try {
        // A confirmed snapshot includes every earlier edit for this workout.
        // Changes made while the request was in flight have a larger sequence.
        for (const item of pending(request.result, meta)) {
          if (item.workoutId === operation.workoutId && item.sequence <= operation.sequence) store.delete(PREFIX + item.id);
        }
        if (version !== null) {
          meta.serverVersions ??= {};
          meta.serverVersions[operation.workoutId] = Math.max(meta.serverVersions[operation.workoutId] ?? 0,version);
        }
        meta.lastSyncedAt = new Date().toISOString(); store.put(meta, META); done();
      } catch (error) { fail(error); }
    };
  }));
  notify("ack");
}
export async function recordSyncFailure(operation: PendingOperation, error: string, nextAttemptAt: number, blocked: boolean) {
  await transaction<void>((store, done) => {
    const key = PREFIX + operation.id; const request = store.get(key);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, attempts: operation.attempts + 1, nextAttemptAt, blocked, error }, key);
      done();
    };
  });
}

export async function mergeDownloads(accountId: string, entries: RemoteWorkout[]) {
  let changed = false;
  await transaction<void>((store,done,fail)=>read(store,fail,(state,meta)=>{
    if (meta.owner?.id !== accountId) throw new Error("The sync account changed. Downloaded data was not imported.");
    enqueue(store,meta,state);
    const request = store.getAll(pendingRange());
    request.onsuccess = () => {
      try {
        const merged = mergeRemote(state,meta,pending(request.result,meta),entries,protectedWorkouts());
        merged.metadata.lastPulledAt = new Date().toISOString();
        store.put(merged.metadata,META);
        if (merged.changed) { store.put(merged.state,KEY); changed = true; }
        done();
      } catch(error) { fail(error); }
    };
  }));
  if (changed) notify("remote");
}
export async function completeSync(accountId: string): Promise<boolean> {
  return transaction<boolean>((store,done,fail)=>read(store,fail,(state,meta)=>{
    if (meta.owner?.id!==accountId) throw new Error("The sync account changed.");
    enqueue(store,meta,state);
    const request=store.getAll(pendingRange());
    request.onsuccess=()=>{
      try {
        const complete=pending(request.result,meta).length===0 && !Object.keys(meta.conflicts??{}).length && !meta.deferred?.length;
        if (complete) meta.lastCompletedAt=new Date().toISOString();
        store.put(meta,META);done(complete);
      } catch(error){fail(error);}
    };
  }));
}
export async function keepBothVersions(accountId: string, id: string) {
  await transaction<void>((store,done,fail)=>read(store,fail,(state,meta)=>{
    if (meta.owner?.id!==accountId) throw new Error("Sign in to the linked account to resolve this workout.");
    if (protectedWorkouts().has(id)) throw new Error("Save or cancel the unfinished set before keeping both versions.");
    enqueue(store,meta,state);
    const remote = meta.conflicts?.[id];
    if (!remote) { done(); return; }
    const workouts = new Map(allWorkouts(state).map(workout=>[workout.id,workout]));
    const local = workouts.get(id);
    let copy: WorkoutSnapshot | null = null;
    if (local) {
      copy = { ...local, id: crypto.randomUUID(), exercises: local.exercises.map(exercise=>({ ...exercise,id:crypto.randomUUID(),sets:exercise.sets.map(set=>({ ...set,id:crypto.randomUUID() })) })) };
      workouts.set(copy.id,copy);
    }
    if (remote.deleted) workouts.delete(id); else workouts.set(id,remote.workout!);
    const next = { ...arrangeWorkouts(state,workouts,state.active?.id===id ? copy?.id : state.active?.id), revision:state.revision+1 };
    const request = store.getAll(pendingRange());
    request.onsuccess = () => {
      try {
        for (const operation of pending(request.result,meta)) if (operation.workoutId===id) store.delete(PREFIX+operation.id);
        meta.serverVersions ??= {}; meta.serverVersions[id] = remote.version;
        const actual = new Map(allWorkouts(next).map(workout=>[workout.id,workout]));
        meta.snapshots[id] = snapshotText(actual.get(id)??null);
        delete meta.conflicts![id];
        enqueue(store,meta,next);
        store.put(next,KEY);store.put(meta,META);done();
      } catch(error) { fail(error); }
    };
  }));
  notify("remote"); notify();
}
