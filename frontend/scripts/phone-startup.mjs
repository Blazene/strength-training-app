import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';

async function busy(port) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', (error) => error.code === 'EADDRINUSE' ? resolve(true) : reject(error));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(false)));
  });
}
function response(request, options) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ ...options, hostname: '127.0.0.1', agent: false }, (incoming) => {
      const chunks = []; let size = 0;
      incoming.on('data', (data) => { size += data.length; if (size > 65536) outgoing.destroy(new Error('Unexpected preview response.')); else chunks.push(data); });
      incoming.on('end', () => incoming.statusCode === 200 ? resolve(Buffer.concat(chunks)) : reject(new Error('Preview check failed.')));
      incoming.on('error', reject);
    });
    outgoing.setTimeout(1500, () => outgoing.destroy(new Error('Preview check timed out.')));
    outgoing.on('error', reject);
    outgoing.end();
  });
}
export async function inspectPhonePreview({ setupPort, httpsPort, certificateFile }) {
  if (setupPort === httpsPort) throw new Error('Phone setup and HTTPS ports must be different.');
  const occupied = await Promise.all([setupPort, httpsPort].map(busy));
  const busyPorts = [setupPort, httpsPort].filter((_port, index) => occupied[index]);
  if (busyPorts.length === 0) return { status: 'available', busyPorts };
  if (busyPorts.length === 2) {
    try {
      const ca = await readFile(certificateFile);
      const [servedCertificate, manifestBody] = await Promise.all([
        response(httpRequest, { port: setupPort, path: '/strength-training-test-ca.cer' }),
        response(httpsRequest, { port: httpsPort, path: '/manifest.webmanifest', ca })
      ]);
      const manifest = JSON.parse(manifestBody.toString());
      if (servedCertificate.equals(new X509Certificate(ca).raw) && manifest.name === 'Strength Training' && manifest.start_url === '/') {
        return { status: 'running', busyPorts };
      }
    } catch { /* An occupied port is only reusable after both identity checks pass. */ }
  }
  return { status: 'conflict', busyPorts };
}
