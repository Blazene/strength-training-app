import { useOfflineAccess } from "../hooks/useOfflineAccess";

export default function OfflineStatus() {
  const { online, access, updateWaiting, retry } = useOfflineAccess();
  const message = access === "ready"
    ? online ? "Ready for offline use" : "Offline — keep logging. Workouts save on this device."
    : access === "development"
      ? "Offline launch is available in the built app."
      : access === "preparing"
        ? "Preparing offline access. Keep this page open for a moment."
        : access === "unsupported"
          ? "Offline launch is unavailable in this browser."
          : "Offline access could not be prepared. Your saved workouts are still on this device.";

  return (
    <aside className="offline-panel" aria-label="Offline access">
      <p role="status">{message}</p>
      {!online && access !== "ready" ? <p>You’re offline. Reopening the app may need a connection.</p> : null}
      {access === "unavailable" ? (
        <button className="secondary small" type="button" onClick={retry}>Retry offline setup</button>
      ) : null}
      {updateWaiting ? (
        <p>An update is ready. Save your sets, then close all training tabs and reopen the app to use it.</p>
      ) : null}
    </aside>
  );
}
