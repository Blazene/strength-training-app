import type { WorkoutSync } from "../hooks/useWorkoutSync";

export default function SyncStatus({ sync }: { sync: WorkoutSync }) {
  const owner = sync.metadata?.owner;
  const waiting = `${sync.pendingCount} ${sync.pendingCount === 1 ? "change" : "changes"} waiting`;
  const message = !owner ? "Saved on this device · Sync is off" : {
    loading: "Checking saved changes…", off: "Saved on this device · Sync is off",
    offline: `Saved on this device · Offline${sync.pendingCount ? ` · ${waiting}` : ""}`,
    signin: `Saved on this device · Sign in to sync${sync.pendingCount ? ` · ${waiting}` : ""}`,
    "different-account": "Saved on this device · Sync paused for this account",
    syncing: `Syncing · ${waiting}`, synced: `Synced to ${owner.email}`,
    retrying: `Saved on this device · Waiting to retry · ${waiting}`,
    attention: `Saved on this device · Sync needs attention · ${waiting}`
  }[sync.status];
  return (
    <section className="sync-panel" aria-label="Workout sync">
      <p role="status"><strong>{message}</strong></p>
      {!owner ? (
        <>
          <p className="muted">{sync.user ? `Enable sync to upload this device’s saved workouts and future changes to ${sync.user.email}.` : "Sign in through Account to enable workout syncing."}</p>
          {sync.user && sync.accountStatus === "ready" ? <button type="button" className="secondary" onClick={() => void sync.enable()}>Enable sync for this device</button> : null}
        </>
      ) : (
        <>
          {sync.status === "signin" || sync.status === "different-account" ? <p className="muted">These workouts are linked to {owner.email}. Sign in to that account to sync them.</p> : null}
          {sync.metadata?.lastSyncedAt ? <p className="muted">Last server confirmation: {new Date(sync.metadata.lastSyncedAt).toLocaleString()}.</p> : null}
          {sync.status === "synced" && !sync.metadata?.lastSyncedAt ? <p className="muted">Sync is enabled. New workouts will upload while the app is open and connected.</p> : null}
          {sync.user?.id === owner.id && sync.status !== "syncing" ? <button type="button" className="secondary" onClick={sync.retry}>Sync now</button> : null}
        </>
      )}
      {sync.error ? <p className="muted">{sync.error}</p> : null}
    </section>
  );
}
