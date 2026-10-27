import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as tcp } from 'node:net';
import { createServer as http } from 'node:http';
import { createServer as https } from 'node:https';
import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectPhonePreview } from '../scripts/phone-startup.mjs';

async function listen(server: ReturnType<typeof tcp>) {
  await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  return address.port;
}
async function close(server: ReturnType<typeof tcp>) {
  await new Promise<void>(resolve => server.close(() => resolve()));
}
async function freePort() { const server = tcp(); const port = await listen(server); await close(server); return port; }

test('fresh preview needs no existing certificate and rejects equal ports', async () => {
  const setupPort = await freePort(); let httpsPort = await freePort();
  while (httpsPort === setupPort) httpsPort = await freePort();
  assert.equal((await inspectPhonePreview({setupPort, httpsPort, certificateFile:'/missing'})).status, 'available');
  await assert.rejects(inspectPhonePreview({setupPort, httpsPort:setupPort, certificateFile:'/unused'}), /different/);
});
test('partial and unrelated conflicts do not stop existing listeners', async () => {
  const first = tcp(); const second = tcp(); const setupPort = await listen(first); const httpsPort = await freePort();
  try {
    const result = await inspectPhonePreview({setupPort, httpsPort, certificateFile:'/missing'});
    assert.equal(result.status, 'conflict'); assert.deepEqual(result.busyPorts, [setupPort]);
    await new Promise<void>(resolve => second.listen(httpsPort, '0.0.0.0', resolve));
    assert.equal((await inspectPhonePreview({setupPort, httpsPort, certificateFile:'/missing'})).status, 'conflict');
    assert.equal(first.listening, true); assert.equal(second.listening, true);
  } finally { await close(first); if (second.listening) await close(second); }
});
test('recognizes a matching certificate and HTTPS app, and rejects a different certificate', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'strength-startup-'));
  let bootstrap: ReturnType<typeof http> | undefined; let app: ReturnType<typeof https> | undefined;
  try {
    await writeFile(join(folder,'cert.conf'), '[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n');
    execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',join(folder,'cert.conf'),'-keyout',join(folder,'key.pem'),'-out',join(folder,'cert.pem')], {stdio:'ignore'});
    const cert = await readFile(join(folder,'cert.pem')); let served = new X509Certificate(cert).raw;
    bootstrap = http((_req,res) => res.end(served));
    app = https({cert, key:await readFile(join(folder,'key.pem'))}, (_req,res) => res.end(JSON.stringify({name:'Strength Training', start_url:'/'})));
    const setupPort = await listen(bootstrap); const httpsPort = await listen(app);
    const options = {setupPort, httpsPort, certificateFile:join(folder,'cert.pem')};
    assert.equal((await inspectPhonePreview(options)).status, 'running');
    served = Buffer.from('another certificate');
    assert.equal((await inspectPhonePreview(options)).status, 'conflict'); assert.equal(app.listening, true);
  } finally {
    if (bootstrap?.listening) await close(bootstrap); if (app?.listening) await close(app);
    await rm(folder, {recursive:true, force:true});
  }
});
