import { isWorkout } from "../storage/workouts";
import type { PendingOperation, RemoteWorkout } from "./model";
export class SyncRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function requestJson(path: string, signal: AbortSignal, body?: object) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 15000);
  try {
    const response = await fetch(path, { method: body ? "POST" : "GET", credentials:"same-origin",cache:"no-store",signal:controller.signal,
      ...(body ? { headers:{"Content-Type":"application/json","X-Strength-Sync-Protocol":"2"},body:JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new SyncRequestError(typeof result.error === "string" ? result.error : "Sync could not finish.",response.status);
    return result;
  } finally { clearTimeout(timeout); signal.removeEventListener("abort",cancel); }
}
export async function uploadOperation(operation: PendingOperation, signal: AbortSignal): Promise<number | null> {
  const result = await requestJson("/api/sync",signal,{ accountId:operation.ownerId,id:operation.id,deviceId:operation.deviceId,
    sequence:operation.sequence,workoutId:operation.workoutId,kind:operation.kind,workout:operation.workout,baseVersion:operation.baseVersion });
  if (result.accountId!==operation.ownerId || result.operationId!==operation.id || !["applied","superseded"].includes(result.outcome)
    || !(result.version==null || (Number.isSafeInteger(result.version) && result.version>0))) {
    throw new Error("The server acknowledgement could not be confirmed. Saved changes were kept.");
  }
  return result.version ?? null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isRemoteWorkout(value: unknown): value is RemoteWorkout {
  if (!value || typeof value!=="object") return false;
  const entry=value as RemoteWorkout;
  return uuid.test(entry.id) && (entry.deviceId===null || uuid.test(entry.deviceId))
    && Number.isSafeInteger(entry.sequence) && entry.sequence>0 && Number.isSafeInteger(entry.version) && entry.version>0
    && typeof entry.deleted==="boolean" && (entry.deleted ? entry.workout===null :
      isWorkout(entry.workout) && entry.workout.id===entry.id && (entry.workout.completedAt===null ||
        typeof entry.workout.completedAt==="string" && Number.isFinite(Date.parse(entry.workout.completedAt)) && Date.parse(entry.workout.completedAt)>=Date.parse(entry.workout.startedAt)));
}
export async function downloadAllWorkouts(accountId: string, signal: AbortSignal, progress: (count: number)=>void = ()=>{}) {
  const entries: RemoteWorkout[]=[];
  const seen=new Set<string>();
  let cursor: string|null=null;
  do {
    const query=new URLSearchParams({ accountId,limit:"20",...(cursor ? {cursor} : {}) });
    const result=await requestJson("/api/sync/workouts?"+query,signal);
    if (result.accountId!==accountId || !Array.isArray(result.entries) || result.entries.length>20 || !result.entries.every(isRemoteWorkout)) throw new Error("Downloaded workouts could not be validated. Your local workouts were kept.");
    for (const entry of result.entries as RemoteWorkout[]) {
      if (seen.has(entry.id) || (cursor && entry.id<=cursor)) throw new Error("The download cursor repeated. Your local workouts were kept.");
      seen.add(entry.id);entries.push(entry);
    }
    const next=result.nextCursor;
    if (!(next===null || typeof next==="string" && uuid.test(next) && result.entries.length>0 && next===result.entries.at(-1).id && (!cursor || next>cursor))) throw new Error("The download cursor could not be validated.");
    cursor=next;progress(entries.length);
  } while (cursor);
  return entries;
}
