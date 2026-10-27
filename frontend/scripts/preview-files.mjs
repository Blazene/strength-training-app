import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};

export async function loadPreviewAsset(directory, requestUrl) {
  try {
    const path = decodeURIComponent(new URL(requestUrl, 'https://localhost').pathname);
    if (path.includes('\0') || path === '/api' || path.startsWith('/api/')) return null;
    const root = await realpath(directory);
    const file = await realpath(resolve(root, path === '/' ? 'index.html' : `.${path}`));
    const inside = relative(root, file);
    if (inside.startsWith('..') || isAbsolute(inside) || !(await stat(file)).isFile()) return null;
    return { body: await readFile(file), type: types[extname(file)] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}
