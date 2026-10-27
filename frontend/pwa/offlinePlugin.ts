import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const publicFiles = [
  "manifest.webmanifest", "app-icon.svg", "icons/icon-192.png",
  "icons/icon-512.png", "icons/apple-touch-icon.png"
];

export function offlinePlugin(): Plugin {
  let publicDirectory = "";
  return {
    name: "strength-training-offline",
    apply: "build",
    enforce: "post",
    configResolved(config) { publicDirectory = config.publicDir; },
    async generateBundle(_options, bundle) {
      const fingerprint = createHash("sha256");
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        fingerprint.update(name).update(item.type === "chunk" ? item.code : item.source);
      }
      for (const name of publicFiles) {
        fingerprint.update(await readFile(resolve(publicDirectory, name)));
      }
      const version = fingerprint.digest("hex").slice(0, 16);
      const paths = ["/", ...Object.keys(bundle).filter((name) => !name.endsWith(".map")).map((name) => `/${name}`), ...publicFiles.map((name) => `/${name}`)];
      this.emitFile({ type: "asset", fileName: "sw.js", source: workerSource(version, paths) });
    }
  };
}

function workerSource(version: string, paths: string[]) {
  return `
const PREFIX = "strength-training-shell-";
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(paths)};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((path) => new Request(path, { cache: "reload" })));
  })());
  // Updates wait until existing app tabs close, preserving in-progress forms.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_STATUS") {
    event.ports[0]?.postMessage({ ok: true, cacheName: CACHE });
    return;
  }
  if (event.data?.type !== "CACHE_APP") return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(FILES.map((path) => new Request(path, { cache: "reload" })));
      event.ports[0]?.postMessage({ ok: true });
    } catch {
      event.ports[0]?.postMessage({ ok: false });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const fallback = await cache.match("/");
      const controller = new AbortController();
      const timeout = fallback ? setTimeout(() => controller.abort(), 2000) : undefined;
      try {
        const response = await fetch(request, { signal: controller.signal });
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const html = await response.clone().text();
          if (html.includes("/@vite/client")) {
            // Returning to the dev server must restore normal hot reload.
            await self.registration.unregister();
            await Promise.all((await caches.keys()).filter((name) => name.startsWith(PREFIX)).map((name) => caches.delete(name)));
          } else {
            try { await cache.put("/", response.clone()); } catch { /* Keep the online page usable if storage is full. */ }
          }
          return response;
        }
        return fallback || response;
      } catch {
        return fallback || Response.error();
      } finally {
        clearTimeout(timeout);
      }
    })());
    return;
  }

  if (!FILES.includes(url.pathname) && !url.pathname.startsWith("/assets/")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* Return the fetched asset even if caching fails. */ }
    }
    return response;
  })());
});
`;
}
