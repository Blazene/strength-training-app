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
      const fingerprint = createHash("sha256").update("atomic-shell-v2");
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        fingerprint.update(name).update(item.type === "chunk" ? item.code : item.source);
      }
      for (const name of publicFiles) {
        fingerprint.update(await readFile(resolve(publicDirectory, name)));
      }
      const version = fingerprint.digest("hex").slice(0, 16);
      const paths = ["/", ...Object.keys(bundle).filter((name) => !name.endsWith(".map")).map((name) => `/${name}`), ...publicFiles.map((name) => `/${name}`), "/app-shell.json"];
      this.emitFile({ type: "asset", fileName: "app-shell.json", source: JSON.stringify({ version, files: paths }) });
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
      let onlineResponse;
      try {
        const response = await fetch(request, { signal: controller.signal });
        onlineResponse = response;
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          const html = await response.clone().text();
          if (html.includes("/@vite/client")) {
            // Returning to the dev server must restore normal hot reload.
            await self.registration.unregister();
            await Promise.all((await caches.keys()).filter((name) => name.startsWith(PREFIX)).map((name) => caches.delete(name)));
          } else {
            const critical = [...html.matchAll(/<(?:script|link)\\b[^>]*(?:src|href)=["']([^"']+)["']/gi)]
              .map((match) => new URL(match[1], response.url || request.url))
              .filter((asset) => asset.origin === self.location.origin).map((asset) => asset.href);
            const sameHtml = fallback && (await fallback.clone().text()) === html;
            const cached = await Promise.all(critical.map((asset) => cache.match(asset)));
            if (!sameHtml || cached.some((asset) => !asset)) {
              // Fetch inside the worker goes straight to the network. The build
              // manifest includes lazy chunks as well as the HTML's entry files.
              const manifestResponse = await fetch(new URL("/app-shell.json", self.location.origin), { cache: "no-store", signal: controller.signal });
              if (!manifestResponse.ok) throw new Error("App manifest unavailable");
              const manifest = await manifestResponse.json();
              if (!Array.isArray(manifest.files) || !manifest.files.length || !manifest.files.every((path) => typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && path !== "/api" && !path.startsWith("/api/"))) throw new Error("Invalid app manifest");
              const files = manifest.files.map((path) => {
                const asset = new URL(path, self.location.origin);
                if (asset.origin !== self.location.origin || asset.pathname === "/api" || asset.pathname.startsWith("/api/")) throw new Error("App manifest includes an API URL");
                return asset.href;
              });
              if (!critical.every((asset) => files.includes(asset))) throw new Error("App build changed during update");
              const assets = [...new Set(files.filter((asset) => !["/", "/index.html"].includes(new URL(asset).pathname)))];
              // addAll writes the asset batch atomically. HTML is replaced last,
              // so a missing chunk, abort or quota failure leaves a usable shell.
              await cache.addAll(assets.map((asset) => new Request(asset, { cache: "reload", signal: controller.signal })));
              await cache.put("/", response.clone());
            }
          }
          return response;
        }
        return fallback || response;
      } catch {
        return fallback || onlineResponse || Response.error();
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
