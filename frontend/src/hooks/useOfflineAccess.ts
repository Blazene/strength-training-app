import { useEffect, useState } from "react";

type Access = "preparing" | "ready" | "unavailable" | "development" | "unsupported";

export function useOfflineAccess() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [access, setAccess] = useState<Access>(import.meta.env.DEV ? "development" : "preparing");
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function connected() { setOnline(true); }
    function disconnected() { setOnline(false); }
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    async function register() {
      if (!("serviceWorker" in navigator) || !window.isSecureContext) {
        if (!cancelled) setAccess("unsupported");
        return;
      }
      if (import.meta.env.DEV) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((registration) =>
          [registration.active, registration.waiting, registration.installing].some((worker) =>
            worker && new URL(worker.scriptURL).pathname === "/sw.js"
          )
        ).map((registration) => registration.unregister()));
        return;
      }
      if (!cancelled) setAccess("preparing");
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      if (cancelled) return;

      function watchWorker(worker: ServiceWorker | null) {
        if (!worker) return;
        function changed() {
          if (cancelled || !worker) return;
          if (worker.state === "activated") setAccess("ready");
          if (worker.state === "installed" && registration.active) setUpdateWaiting(true);
          if (worker.state === "redundant" && !registration.active) setAccess("unavailable");
        }
        worker.addEventListener("statechange", changed);
        cleanups.push(() => worker.removeEventListener("statechange", changed));
        changed();
      }

      watchWorker(registration.installing);
      const updated = () => watchWorker(registration.installing);
      registration.addEventListener("updatefound", updated);
      cleanups.push(() => registration.removeEventListener("updatefound", updated));
      if (registration.waiting) setUpdateWaiting(true);
      if (registration.active) setAccess("ready");
    }

    void register().catch(() => { if (!cancelled) setAccess("unavailable"); });
    return () => { cancelled = true; cleanups.forEach((cleanup) => cleanup()); };
  }, [attempt]);

  return { online, access, updateWaiting, retry: () => setAttempt((value) => value + 1) };
}
