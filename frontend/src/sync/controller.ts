import { acknowledge, bindSyncAccount, readSyncState, recordSyncFailure, STORAGE_EVENT, STORAGE_SIGNAL } from "../storage/sync";
import { accountRequest } from "../utils/accountApi";
import type { AccountUser } from "../utils/accountApi";
import { isAccountUser, latestOperations, retryDelay } from "./model";
import type { StoredSync, SyncMetadata } from "./model";
import { SyncRequestError, uploadOperation } from "./network";

export type SyncView = {
  user: AccountUser | null;
  accountStatus: "checking" | "ready" | "unavailable";
  metadata: SyncMetadata | null;
  pendingCount: number;
  status: "loading" | "off" | "offline" | "signin" | "different-account" | "syncing" | "synced" | "retrying" | "attention";
  error: string;
};
export class SyncController {
  private view: SyncView = { user: null, accountStatus: "checking", metadata: null, pendingCount: 0, status: "loading", error: "" };
  private listeners = new Set<() => void>();
  private active = false;
  private running = false;
  private rerun = false;
  private force = false;
  private epoch = 0;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<SyncView>) { this.view = { ...this.view, ...change }; this.listeners.forEach(listener => listener()); }
  private changed = () => { if (this.view.metadata?.owner) this.publish({ status: "loading" }); this.wake(); };
  private reconnected = () => this.wake(true);
  private storageChanged = (event: StorageEvent) => { if (event.key === STORAGE_SIGNAL) this.wake(); };
  private visible = () => { if (document.visibilityState === "visible") this.wake(true); };
  start = () => {
    this.active = true;
    window.addEventListener(STORAGE_EVENT, this.changed);
    window.addEventListener("storage", this.storageChanged);
    window.addEventListener("online", this.reconnected);
    window.addEventListener("offline", this.reconnected);
    window.addEventListener("pageshow", this.reconnected);
    document.addEventListener("visibilitychange", this.visible);
    this.wake(true);
  };
  stop = () => {
    this.active = false; this.epoch++; this.controller?.abort(); clearTimeout(this.timer);
    window.removeEventListener(STORAGE_EVENT, this.changed);
    window.removeEventListener("storage", this.storageChanged);
    window.removeEventListener("online", this.reconnected);
    window.removeEventListener("offline", this.reconnected);
    window.removeEventListener("pageshow", this.reconnected);
    document.removeEventListener("visibilitychange", this.visible);
  };
  sessionChanged = (user: AccountUser | null) => {
    this.epoch++; this.controller?.abort();
    this.publish({ user, accountStatus: "ready" });
    this.wake(true);
  };
  retry = () => this.wake(true);
  enable = async () => {
    const user = this.view.user;
    if (!user) return;
    try { await bindSyncAccount(user); this.wake(true); }
    catch (error) { this.publish({ status: "attention", error: error instanceof Error ? error.message : "Sync could not be enabled. Your workouts are still saved." }); }
  };
  private wake(force = false) {
    if (!this.active) return;
    this.force ||= force; this.rerun = true; clearTimeout(this.timer);
    if (!this.running) void this.pump();
  }
  private schedule(delay: number) { clearTimeout(this.timer); this.timer = setTimeout(() => this.wake(), Math.max(100, delay)); }
  private async pump() {
    this.running = true;
    try {
      while (this.active && this.rerun) {
        this.rerun = false; const force = this.force; this.force = false;
        await this.pass(force);
      }
    } catch (error) {
      if (this.active) this.publish({ status: "attention", error: error instanceof Error ? error.message : "Saved sync information could not be read. Your workouts are still saved." });
    } finally { this.running = false; }
  }
  private showStored(stored: StoredSync) {
    this.publish({ metadata: stored.metadata, pendingCount: stored.pending.length });
  }
  private async pass(force: boolean) {
    const epoch = this.epoch;
    const valid = () => this.active && this.epoch === epoch;
    let stored = await readSyncState();
    if (!valid()) return;
    this.showStored(stored);
    if (!navigator.onLine) {
      this.publish({ status: "offline", error: "", ...(this.view.user ? {} : { accountStatus: "unavailable" as const }) }); return;
    }
    const controller = new AbortController(); this.controller = controller;
    let user: AccountUser | null;
    try {
      const result = await accountRequest("/api/me", undefined, controller.signal);
      if (result?.user && !isAccountUser(result.user)) throw new Error("The signed-in account could not be confirmed.");
      user = result?.user ?? null;
    } catch {
      if (!valid()) return;
      this.publish({ accountStatus: "unavailable", status: stored.metadata.owner ? "retrying" : "off", error: "Account service is unavailable. Your changes are saved on this device." });
      if (stored.metadata.owner) this.schedule(10000);
      return;
    }
    if (!valid()) return;
    this.publish({ user, accountStatus: "ready", error: "" });
    if (!stored.metadata.owner) { this.publish({ status: "off" }); return; }
    if (!user) { this.publish({ status: "signin" }); return; }
    if (stored.metadata.owner.id !== user.id) { this.publish({ status: "different-account" }); return; }
    while (valid()) {
      const latest = latestOperations(stored.pending);
      if (!latest.length) { this.publish({ status: "synced", error: "" }); return; }
      const operation = latest.find(item => force || (!item.blocked && item.nextAttemptAt <= Date.now()));
      if (!operation) {
        const retryable = latest.filter(item => !item.blocked);
        if (retryable.length) {
          this.publish({ status: "retrying", error: retryable[0].error });
          this.schedule(Math.min(...retryable.map(item => item.nextAttemptAt)) - Date.now());
        } else this.publish({ status: "attention", error: latest[0].error });
        return;
      }
      this.publish({ status: "syncing", error: "" });
      try {
        await uploadOperation(operation, controller.signal);
        if (!valid()) return;
        await acknowledge(operation);
      } catch (error) {
        if (!valid()) return;
        if (error instanceof SyncRequestError && [401, 403].includes(error.status)) {
          this.publish({ user: null, accountStatus: "ready", status: "signin", error: "Sign back in to the account linked to these workouts. All pending changes were kept." }); return;
        }
        const blocked = error instanceof SyncRequestError && [400, 409, 413, 422].includes(error.status);
        const message = error instanceof SyncRequestError ? error.message : "The server did not confirm this upload. Saved changes will retry automatically.";
        const nextAttemptAt = Date.now() + retryDelay(operation.attempts + 1);
        await recordSyncFailure(operation, message, nextAttemptAt, blocked);
        stored = await readSyncState(); this.showStored(stored);
        if (!blocked) { this.publish({ status: navigator.onLine ? "retrying" : "offline", error: message }); this.schedule(nextAttemptAt - Date.now()); return; }
        // A newer corrected snapshot can supersede a rejected older one. Other
        // workouts can also continue while this particular operation needs help.
        force = false;
        continue;
      }
      stored = await readSyncState();
      if (!valid()) return;
      this.showStored(stored);
    }
  }
}
