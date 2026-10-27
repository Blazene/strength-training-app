import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadPreviewAsset } from './preview-files.mjs';

const endpoint = '/api/app-update';

async function snapshot(directory) {
  const worker = await readFile(resolve(directory, 'sw.js'), 'utf8');
  const files = JSON.parse(worker.match(/^const FILES = (\[.*\]);$/m)?.[1] ?? 'null');
  if (!Array.isArray(files) || !files.includes('/') || !files.every(file => typeof file === 'string' && file.startsWith('/') && !file.startsWith('/api'))) {
    throw new Error('Build the frontend before updating the phone app.');
  }
  return { version: createHash('sha256').update(worker).digest('hex').slice(0, 16), files };
}

// This page and its downloads live under /api, which every shipped app worker
// leaves to the network. A query string on the app itself cannot ensure that.
export async function handlePhoneUpdate(request, response, directory) {
  const url = new URL(request.url, 'https://localhost');
  if (![endpoint, `${endpoint}/status`, `${endpoint}/file`].includes(url.pathname)) return false;
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, allow: 'GET, HEAD' }); response.end(); return true;
  }
  try {
    const build = await snapshot(directory);
    let body; let type;
    if (url.pathname === `${endpoint}/file`) {
      const path = url.searchParams.get('path');
      const asset = build.files.includes(path) ? await loadPreviewAsset(directory, path) : null;
      if (!asset) { response.writeHead(404, headers); response.end(); return true; }
      body = asset.body; type = asset.type;
    } else if (url.pathname === `${endpoint}/status`) {
      body = JSON.stringify(build); type = 'application/json';
    } else {
      body = updatePage(build.version); type = 'text/html; charset=utf-8';
    }
    response.writeHead(200, { ...headers, 'content-type': type, 'x-app-build': build.version });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(503, { ...headers, 'content-type': 'text/plain; charset=utf-8' });
    response.end('The app update is unavailable. Build the frontend, then retry. Saved workouts have not been changed.');
  }
  return true;
}

function updatePage(version) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#10141d"><title>Update Strength Training</title><style>body{font:17px system-ui;max-width:600px;margin:40px auto;padding:0 20px;background:#10141d;color:#ecf2ff;line-height:1.6}button{font:inherit;min-height:52px;padding:12px 20px;border:0;border-radius:8px;background:#bef264;color:#152000;font-weight:700;cursor:pointer}button:disabled{opacity:.6}a{color:#bef264}.muted{color:#bac7dc}#status{overflow-wrap:anywhere}</style></head><body><h1>Update Strength Training</h1><p>Your phone has reached the current app on your Mac.</p><p>Tap below to download the latest app files, then open the workout screen. Saved workouts and account cookies on this address are kept.</p><p>First, save any unfinished set in your other app tabs. Close them before updating.</p><button id="update" type="button">Refresh app</button><p id="status" role="status" aria-live="polite"></p><p class="muted">Mac build: ${version}</p><p><a href="/">Return to workouts</a></p><script>(${refreshApp.toString()})();</script></body></html>`;
}

function refreshApp() {
  const button = document.getElementById('update');
  const status = document.getElementById('status');
  async function download(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Download failed');
      return new Response(await response.arrayBuffer(), { headers: response.headers });
    } finally { clearTimeout(timeout); }
  }
  button.addEventListener('click', async () => {
    button.disabled = true; status.textContent = 'Downloading the latest app…';
    try {
      if (!('caches' in window) || !('serviceWorker' in navigator)) throw new Error('Secure app storage unavailable');
      const build = await (await download('/api/app-update/status')).json();
      // Fetch every file through the uncached endpoint before touching a cache.
      const files = await Promise.all(build.files.map(async path => {
        const response = await download('/api/app-update/file?path=' + encodeURIComponent(path));
        if (response.headers.get('x-app-build') !== build.version) throw new Error('Build changed');
        return { path, response: new Response(await response.arrayBuffer(), { headers: { 'content-type': response.headers.get('content-type') } }) };
      }));
      const latest = await (await download('/api/app-update/status')).json();
      if (latest.version !== build.version) throw new Error('Build changed');
      status.textContent = 'Saving the updated app files…';
      const names = (await caches.keys()).filter(name => name.startsWith('strength-training-shell-'));
      if (!names.length) names.push('strength-training-shell-recovery-' + build.version);
      // Assets first, HTML last: a failed download never replaces the old shell.
      // Updating existing shells also works while an old worker controls a tab.
      for (const name of names) {
        const cache = await caches.open(name);
        for (const file of files.filter(file => file.path !== '/')) await cache.put(file.path, file.response.clone());
        await cache.put('/', files.find(file => file.path === '/').response.clone());
      }
      // Keep the worker registration intact. Safari can retain the previous
      // controller during navigation after unregistering it. The app checks for
      // a worker update when it opens; every existing shell now has fresh files.
      location.replace('/?app-update=' + encodeURIComponent(build.version));
    } catch {
      status.textContent = 'The update could not finish. Your saved workouts were kept. Keep your Mac running and both devices on the same Wi-Fi, then try again.';
      button.disabled = false;
    }
  });
}
