import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePhoneUpdate } from '../scripts/phone-update.mjs';

test('phone recovery bypasses caches and serves only the current build files', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'strength-update-'));
  const root = join(parent, 'dist');
  await mkdir(root);
  await writeFile(join(root, 'index.html'), '<h1>Current app</h1>');
  await writeFile(join(root, 'sw.js'), 'const FILES = ["/","/index.html"];\n');
  await writeFile(join(parent, 'private.pem'), 'private key');
  // Even a file inside dist must appear in the build manifest to be downloadable.
  await writeFile(join(root, 'unlisted.txt'), 'unlisted');
  const server = createServer(async (request, response) => {
    if (!await handlePhoneUpdate(request, response, root)) { response.writeHead(404); response.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(parent, { recursive: true, force: true }); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  const url = `http://127.0.0.1:${address.port}/api/app-update`;
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(await page.text(), /Refresh app/);
  const status = await (await fetch(url + '/status')).json();
  assert.deepEqual(status.files, ['/', '/index.html']);
  const file = await fetch(url + '/file?path=%2F');
  assert.equal(file.headers.get('x-app-build'), status.version);
  assert.equal(await file.text(), '<h1>Current app</h1>');
  for (const path of ['/../private.pem', '/%2e%2e%2fprivate.pem', '/unlisted.txt', '/api/me']) {
    assert.equal((await fetch(url + '/file?path=' + encodeURIComponent(path))).status, 404);
  }
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  await writeFile(join(root, 'sw.js'), 'const FILES = ["/","/index.html"];\n// New build');
  assert.notEqual((await (await fetch(url + '/status')).json()).version, status.version);
  await rm(join(root, 'sw.js'));
  assert.equal((await fetch(url + '/status')).status, 503);
});
