import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const surahs = JSON.parse(readFileSync(new URL('./data/juz30.json', import.meta.url), 'utf8'));
const list = surahs.map(({ ayat, basmalah, ...meta }) => meta);
const byNumber = new Map(surahs.map((s) => [s.number, s]));

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    // Public, read-only Quran data: any client (PWA now, Flutter later) may read it.
    'access-control-allow-origin': '*',
    // no-cache: clients always revalidate, so a data rebuild reaches them at once; offline is the service worker's job.
    'cache-control': status === 200 ? 'no-cache' : 'no-store',
  });
  res.end(JSON.stringify(body));
}

// The PWA in ../app is served from the same port, so one address (or one tunnel) runs everything.
// The app stays a plain static folder and can still be hosted anywhere else.
const APP_DIR = fileURLToPath(new URL('../app/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};
async function serveApp(path, res) {
  const file = normalize(join(APP_DIR, path || 'index.html'));
  const type = TYPES[extname(file)];
  // Stay inside app/, only known file types, never the test files.
  if (!file.startsWith(APP_DIR) || !type || file.endsWith('.test.js')) return send(res, 404, { error: 'Tidak ditemukan' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    send(res, 404, { error: 'Tidak ditemukan' });
  }
}

export function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Metode tidak didukung' });
  const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  if (path === '/surahs') return send(res, 200, list);
  const m = path.match(/^\/surahs\/(\d{1,3})$/);
  if (m) return byNumber.has(Number(m[1])) ? send(res, 200, byNumber.get(Number(m[1]))) : send(res, 404, { error: 'Tidak ditemukan' });
  return serveApp(path, res);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createServer(handler).listen(port, () => console.log(`Murottal di http://localhost:${port}`));
}
