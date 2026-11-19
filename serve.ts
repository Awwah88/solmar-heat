// Solmar Heat — dev server. Serves game/ as static files on localhost.
// Usage: node serve.ts [--port 8080]  (default port 8080).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
let port = 8080;
const flag = process.argv.indexOf('--port');
if (flag >= 0 && process.argv[flag + 1]) port = Number(process.argv[flag + 1]) || 8080;
const types: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    if (existsSync(path) && path.endsWith('/')) path = join(path, 'index.html');
    if (url.pathname === '/') path = join(root, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
server.listen(port, () => console.log(`Solmar Heat serving game/ at http://localhost:${port}`));
