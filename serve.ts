// Solmar Heat — a tiny static file server for local play and screenshots.
// Serves the repository root: `/` is game/index.html, and any path that is not
// found at the root is tried under game/ (so the page works whether it is
// served from the repo root or from game/ itself). No build step, no network.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function portFromArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--port' && args[i + 1]) return Number(args[i + 1]);
    if (a.startsWith('--port=')) return Number(a.slice('--port='.length));
  }
  return 8080;
}

const ROOT = process.cwd();
const PORT = portFromArgs();

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (clean === '/' || clean === '') return join(ROOT, 'game', 'index.html');
  const direct = join(ROOT, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const underGame = join(ROOT, 'game', clean);
  if (existsSync(underGame) && statSync(underGame).isFile()) return underGame;
  return null;
}

const server = createServer((req, res) => {
  try {
    const file = resolvePath(req.url || '/');
    if (!file || extname(file) === '.ts') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found\n');
      return;
    }
    const body = readFileSync(file);
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'content-length': body.length });
    res.end(body);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error\n');
  }
});

server.listen(PORT, () => {
  console.log(`Solmar Heat serving ${ROOT} on http://localhost:${PORT}/`);
});
