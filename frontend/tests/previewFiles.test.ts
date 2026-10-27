import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPreviewAsset } from '../scripts/preview-files.mjs';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const parent = await mkdtemp(join(tmpdir(), 'strength-phone-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, 'dist');
  await mkdir(root);
  await writeFile(join(root, 'index.html'), '<h1>Workout</h1>');
  await writeFile(join(parent, 'private-key.pem'), 'private');
  return { root, parent };
}

test('phone preview serves built assets with correct MIME types', async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'sw.js'), 'worker');
  await writeFile(join(root, 'manifest.webmanifest'), '{}');
  assert.match((await loadPreviewAsset(root, '/'))?.body.toString(), /Workout/);
  assert.match((await loadPreviewAsset(root, '/sw.js'))?.type, /javascript/);
  assert.match((await loadPreviewAsset(root, '/manifest.webmanifest'))?.type, /manifest\+json/);
});

test('phone preview cannot serve source, parent files, private keys or API routes', async (t) => {
  const { root, parent } = await fixture(t);
  await symlink(join(parent, 'private-key.pem'), join(root, 'escaped.pem'));
  for (const url of ['/../private-key.pem', '/%2e%2e%2fprivate-key.pem', '/escaped.pem', '/api/auth', '/%00', '/missing', '/%zz']) {
    assert.equal(await loadPreviewAsset(root, url), null, url);
  }
});
