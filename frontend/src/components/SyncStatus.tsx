import type { WorkoutSync } from "../hooks/useWorkoutSync";

export default function SyncStatus({ sync }: { sync: WorkoutSync }) {
  const owner=sync.metadata?.owner;
  const waiting=`${sync.pendingCount} ${sync.pendingCount===1?"workout":"workouts"} waiting`;
  const message=!owner?"Saved on this device · Sync is off":{
    loading:"Checking saved changes…",off:"Saved on this device · Sync is off",
    offline:`Offline · Saved on this device${sync.pendingCount?` · ${waiting}`:""}`,
    signin:`Saved on this device · Sign in to sync${sync.pendingCount?` · ${waiting}`:""}`,
    "different-account":"Saved on this device · Sync paused for this account",
    downloading:`Downloading account workouts…${sync.downloadedCount?` · ${sync.downloadedCount} received`:""}`,
    syncing:`Uploading · ${waiting}`,synced:`Synced to ${owner.email}`,
    retrying:sync.pendingCount?`Saved on this device · Waiting to retry · ${waiting}`:"Saved on this device · Server check waiting to retry",
    attention:`Saved on this device · Sync needs attention${sync.pendingCount?` · ${waiting}`:""}`,
    editing:"Saved on this device · Server update waiting for your unfinished entry"
  }[sync.status];
  const conflicts=Object.values(sync.metadata?.conflicts??{});
  return <section className="sync-panel" aria-label="Workout sync">
    <p role="status"><strong>{message}</strong></p>
    {!owner?<>
      <p className="muted">{sync.user?`Enable sync to upload this device’s saved workouts and download workouts from ${sync.user.email}.`:"Sign in through Account to enable workout syncing and download your history."}</p>
      {sync.user&&sync.accountStatus==="ready"?<button type="button" className="secondary" onClick={()=>void sync.enable()}>Enable sync for this device</button>:null}
    </>:<>
      {sync.status==="signin"||sync.status==="different-account"?<p className="muted">These workouts are linked to {owner.email}. Sign in to that account to sync them.</p>:null}
      {sync.metadata?.lastCompletedAt?<p className="muted">Last complete sync: {new Date(sync.metadata.lastCompletedAt).toLocaleString()}.</p>:sync.metadata?.lastSyncedAt?<p className="muted">Last upload confirmed: {new Date(sync.metadata.lastSyncedAt).toLocaleString()}.</p>:null}
      {sync.nextRetryAt&&sync.status==="retrying"?<p className="muted">Next retry: {new Date(sync.nextRetryAt).toLocaleTimeString()}. You can also retry now.</p>:null}
      {sync.user?.id===owner.id&&!['syncing','downloading'].includes(sync.status)?<button type="button" className="secondary" onClick={sync.retry}>{sync.status==="retrying"||sync.status==="attention"?"Retry sync":"Sync now"}</button>:null}
      {conflicts.length&&sync.user?.id===owner.id?<section aria-label="Workout conflicts">
        <p>Your saved local sets have been kept. Keeping both saves a separate device copy and uses the latest server version for the original workout.</p>
        {conflicts.map(entry=><div key={entry.id} className="sync-conflict">
          <p>{entry.workout?new Date(entry.workout.startedAt).toLocaleString():"A workout deleted on the server"}</p>
          <button type="button" className="secondary" onClick={()=>void sync.keepBoth(entry.id)}>Keep both versions</button>
        </div>)}
      </section>:null}
    </>}
    {sync.error?<p className="muted">{sync.error}</p>:null}
  </section>;
}
