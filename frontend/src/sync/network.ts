import type { PendingOperation } from "./model";
export class SyncRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function uploadOperation(operation: PendingOperation, signal: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 15000);
  try {
    const response = await fetch("/api/sync", {
      method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: operation.ownerId, id: operation.id, deviceId: operation.deviceId,
        sequence: operation.sequence, workoutId: operation.workoutId, kind: operation.kind, workout: operation.workout })
    });
    const result = await response.json();
    if (!response.ok) throw new SyncRequestError(typeof result.error === "string" ? result.error : "Sync could not finish.", response.status);
    if (result.accountId !== operation.ownerId || result.operationId !== operation.id || !["applied", "superseded"].includes(result.outcome)) {
      throw new Error("The server acknowledgement could not be confirmed. Saved changes were kept.");
    }
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", cancel); }
}
