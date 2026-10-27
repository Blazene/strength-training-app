type WorkerReply = { ok?: boolean; cacheName?: string };

function workerMessage(worker: ServiceWorker, type: string, duration: number): Promise<WorkerReply> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const cleanup = () => { clearTimeout(timeout); channel.port1.close(); channel.port2.close(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Offline worker did not reply.")); }, duration);
    channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => { cleanup(); resolve(event.data); };
    try { worker.postMessage({ type }, [channel.port2]); }
    catch (error) { cleanup(); reject(error); }
  });
}

export async function hasCachedApp(worker?: ServiceWorker): Promise<boolean> {
  const required = [new URL("/", location.href).href];
  for (const element of document.querySelectorAll("script[src], link[rel='stylesheet'], link[rel='manifest'], link[rel='icon'], link[rel='apple-touch-icon']")) {
    const path = element.getAttribute("src") ?? element.getAttribute("href");
    if (!path) continue;
    const url = new URL(path, location.href);
    if (url.origin === location.origin) required.push(url.href);
  }
  let names = (await caches.keys()).filter((name) => name.startsWith("strength-training-shell-"));
  if (worker) {
    try {
      const status = await workerMessage(worker, "CACHE_STATUS", 1500);
      if (!status.cacheName?.startsWith("strength-training-shell-")) return false;
      names = [status.cacheName];
    } catch {
      // Older app workers did not implement this message. Only confirm a single,
      // unambiguous cache; a waiting update's cache cannot prove the active one works.
      if (names.length !== 1) return false;
    }
  }
  for (const name of names) {
    const cache = await caches.open(name);
    const matches = await Promise.all(required.map((url) => cache.match(url)));
    if (matches.every(Boolean)) return true;
  }
  return false;
}

export async function repairOfflineCache(worker: ServiceWorker): Promise<void> {
  const result = await workerMessage(worker, "CACHE_APP", 10000);
  if (!result.ok) throw new Error("Offline files could not be prepared.");
}
