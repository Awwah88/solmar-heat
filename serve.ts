// Solmar Heat — dev server. Serves the static game/ folder on a local
// port so the game can be played and screenshotted in a browser.
// Usage: node serve.ts [--port 8080]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, 'game');

const args = process.argv.slice(2);
let port = 8080;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) port = parseInt(args[i + 1], 10);
}

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(root, path);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

server.listen(port, () => {
  console.log(`Solmar Heat at http://localhost:${port}/`);
});
