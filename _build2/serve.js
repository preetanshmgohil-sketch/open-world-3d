#!/usr/bin/env node
/* serve.js — tiny static file server for local play-testing (no dependencies).

   Usage:  node _build2/serve.js [port]        (default port: 8123)
   Then:   http://127.0.0.1:8123/index1.html

   Serves the repository root. Handy for testing the built game and the
   model viewer (_build2/modelview.html) without any extra tooling.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 8123);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.normalize(path.join(root, url));
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) {}
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found: ' + url); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('[serve] port ' + port + ' is already in use - the game may already be running.');
    console.error('        open http://127.0.0.1:' + port + '/index1.html in your browser.');
  } else {
    console.error('[serve] ' + e.message);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log('serving ' + root);
  console.log('  ->  http://127.0.0.1:' + port + '/index1.html');
});
