import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { hostname, networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPreviewAsset } from './preview-files.mjs';
import { proxyAccountApi } from './api-proxy.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const certificateDirectory = resolve(frontend, '../.local/phone-preview');
const httpsPort = Number(process.env.PHONE_HTTPS_PORT ?? 5443);
const setupPort = Number(process.env.PHONE_SETUP_PORT ?? 5080);
for (const port of [httpsPort, setupPort]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Phone preview ports must be between 1024 and 65535.');
}
let localHost;
try { localHost = execFileSync('scutil', ['--get', 'LocalHostName'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch { localHost = hostname().replace(/\.local$/, ''); }
if (!/^[a-zA-Z0-9-]+$/.test(localHost)) throw new Error('The local computer name is not supported.');
const name = `${localHost}.local`;
const addresses = Object.entries(networkInterfaces()).sort(([left], [right]) => left.localeCompare(right)).flatMap(([, entries]) =>
  (entries ?? []).filter((entry) => entry.family === 'IPv4' && !entry.internal).map((entry) => entry.address)
);
const privateAddresses = [...new Set(addresses.filter((address) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)))];
if (privateAddresses.length === 0) throw new Error('Connect your Mac to Wi-Fi, then run npm run phone again.');
await readFile(resolve(frontend, 'dist/index.html'));
await mkdir(certificateDirectory, { recursive: true, mode: 0o700 });
await chmod(certificateDirectory, 0o700);
const path = (file) => resolve(certificateDirectory, file);
function openssl(args) { execFileSync('openssl', args, { cwd: certificateDirectory, stdio: ['ignore', 'pipe', 'pipe'] }); }
let ca;
try { ca = await readFile(path('ca-cert.pem')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(path('ca.conf'), `[req]\ndistinguished_name=dn\nx509_extensions=ca\nprompt=no\n[dn]\nCN=Strength Training Local Test CA\n[ca]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n`);
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '90', '-config', 'ca.conf', '-keyout', 'ca-key.pem', '-out', 'ca-cert.pem']);
  ca = await readFile(path('ca-cert.pem'));
}
const rootCertificate = new X509Certificate(ca);
if (Date.parse(rootCertificate.validTo) <= Date.now() + 86400000) {
  throw new Error('The local test certificate is expiring. Remove its iPhone trust profile and rename .local/phone-preview before setting up a new one.');
}
await readFile(path('ca-key.pem'));
await chmod(path('ca-key.pem'), 0o600);
await writeFile(path('server.conf'), `[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=@names\n[names]\nDNS.1=localhost\nDNS.2=${name}\nIP.1=127.0.0.1\n${privateAddresses.map((address, index) => `IP.${index + 2}=${address}`).join('\n')}\n`);
openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server-key.pem', '-out', 'server.csr', '-subj', `/CN=${name}`]);
openssl(['x509', '-req', '-in', 'server.csr', '-CA', 'ca-cert.pem', '-CAkey', 'ca-key.pem', '-CAcreateserial', '-days', '30', '-sha256', '-extfile', 'server.conf', '-extensions', 'server', '-out', 'server-cert.pem']);
await chmod(path('server-key.pem'), 0o600);
const certificate = rootCertificate.raw;
const appUrl = `https://${name}:${httpsPort}/`;
const setupUrl = `http://${name}:${setupPort}/`;
const ipUrl = `https://${privateAddresses[0]}:${httpsPort}/`;
const setup = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>iPhone workout setup</title><style>body{font:17px system-ui;max-width:600px;margin:40px auto;padding:0 20px;background:#10141d;color:#ecf2ff;line-height:1.7}a{color:#a3e635}li{margin:16px 0}code{overflow-wrap:anywhere;font-size:13px}</style><h1>Set up your iPhone</h1><p>Keep your Mac and iPhone on the same Wi-Fi.</p><ol><li><a href="/strength-training-test-ca.cer">Download this Mac’s test certificate</a> and allow the profile download.</li><li>In Settings → General → VPN &amp; Device Management, install <strong>Strength Training Local Test CA</strong>.</li><li>In Settings → General → About → Certificate Trust Settings, enable full trust for that certificate.</li><li><a href="${appUrl}">Open Strength Training securely</a>. In Safari, choose Share → Add to Home Screen, then open the new icon while connected and wait for Ready for offline use.</li></ol><p>If the Mac name does not resolve, <a href="${ipUrl}">open the app using its Wi-Fi address</a>. Keep using the same address during the test.</p><p>Use the certificate from your own Mac. Remove this test profile after testing. It expires ${rootCertificate.validTo}.</p><p>Certificate SHA-256:<br><code>${rootCertificate.fingerprint256}</code></p><p>Your Mac’s localhost workouts do not transfer to your phone. Start a mock workout on the iPhone.</p></html>`;
const bootstrap = createHttpServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const body = pathname === '/' ? setup : pathname === '/strength-training-test-ca.cer' ? certificate : null;
  if (!body) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': pathname === '/' ? 'text/html; charset=utf-8' : 'application/x-x509-ca-cert', 'cache-control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : body);
});
const app = createHttpsServer({ key: await readFile(path('server-key.pem')), cert: await readFile(path('server-cert.pem')) }, async (request, response) => {
  const pathname = new URL(request.url, 'https://localhost').pathname;
  if (pathname === '/api' || pathname.startsWith('/api/')) { proxyAccountApi(request, response, process.env.BACKEND_URL ?? 'http://127.0.0.1:4001'); return; }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
  const asset = await loadPreviewAsset(resolve(frontend, 'dist'), request.url);
  response.writeHead(asset ? 200 : 404, { 'content-type': asset?.type ?? 'text/plain', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
  response.end(request.method === 'HEAD' ? undefined : asset?.body ?? 'Not found');
});
for (const server of [bootstrap, app]) server.on('error', (error) => { console.error(error.message); bootstrap.close(); app.close(); process.exitCode = 1; });
await Promise.all([
  new Promise((resolve, reject) => { bootstrap.once('error', reject); bootstrap.listen(setupPort, '0.0.0.0', resolve); }),
  new Promise((resolve, reject) => { app.once('error', reject); app.listen(httpsPort, '0.0.0.0', resolve); })
]);
console.log(`\nOn your iPhone, open Safari:\n${setupUrl}\n\nAfter trusting the test certificate, open:\n${appUrl}\n\nSame-Wi-Fi IP fallback: https://${privateAddresses[0]}:${httpsPort}/\nCertificate SHA-256: ${rootCertificate.fingerprint256}\nKeep this terminal running during setup. Control + C stops both local servers.\n`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { bootstrap.close(); app.close(); bootstrap.closeAllConnections(); app.closeAllConnections(); });
