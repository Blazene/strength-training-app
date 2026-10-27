import { request } from 'node:http';
const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'forwarded']);
export function proxyAccountApi(incoming, outgoing, backendUrl) {
  const target = new URL(backendUrl);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('The phone API target must be a local loopback HTTP server.');
  const url = new URL(incoming.url, 'https://localhost');
  const headers = Object.fromEntries(Object.entries(incoming.headers).filter(([name]) => !hopHeaders.has(name) && !name.startsWith('x-forwarded-')));
  headers['x-forwarded-proto'] = 'https';
  const upstream = request({ hostname: target.hostname, port: target.port || 80, path: url.pathname + url.search, method: incoming.method, headers }, (response) => {
    const responseHeaders = Object.fromEntries(Object.entries(response.headers).filter(([name]) => !hopHeaders.has(name)));
    outgoing.writeHead(response.statusCode ?? 502, { ...responseHeaders, 'cache-control': 'no-store' });
    response.pipe(outgoing);
  });
  upstream.setTimeout(10000, () => upstream.destroy());
  upstream.on('error', () => {
    if (outgoing.headersSent) { outgoing.destroy(); return; }
    outgoing.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    outgoing.end(JSON.stringify({ error: 'Account service is unavailable. Your local workouts are unchanged.' }));
  });
  incoming.on('aborted', () => upstream.destroy());
  incoming.pipe(upstream);
}
