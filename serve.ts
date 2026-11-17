// A tiny static server for game/ (Node 22, standard library only), so
// the game can be played locally without a build step: `node serve.ts`
// serves game/ on http://localhost:8080. It sends the MIME types a
// browser game needs, refuses any path outside game/, and otherwise does
// nothing clever: this is a development convenience, not a web server
// for the internet.
//
// Run it with an optional port: `node serve.ts --port 9000`.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));

// Pick the port from --port, falling back to 8080 for anything odd.
function pickPort(argv) {
  const portIndex = argv.indexOf('--port');
  const requested = portIndex === -1 ? 8080 : Number(argv[portIndex + 1]);
  if (Number.isInteger(requested) && requested > 0 && requested < 65536) return requested;
  return 8080;
}

const port = pickPort(process.argv.slice(2));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

// MIME type by extension; unknown types download as plain bytes.
function mimeFor(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Resolve a request path to a file under game/, or null when it escapes
// the root or is not a file.
function resolveGameFile(pathname) {
  let path = pathname;
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(root, normalize(path)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) return null;
    return { file, size: stats.size };
  } catch {
    return null;
  }
}

createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const found = resolveGameFile(pathname);
  if (!found) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mimeFor(found.file),
    'content-length': found.size,
    'cache-control': 'no-store',
  });
  createReadStream(found.file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
});
