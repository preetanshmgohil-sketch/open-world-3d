/* Tiny screenshot receiver for visual QA of the game.
   POST /shot?name=xxx  body = dataURI or raw jpeg bytes  -> writes _build2/shots/xxx.jpg
   POST /log            body = text                      -> appends _build2/shots/log.txt */
const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'shots');
fs.mkdirSync(dir, { recursive: true });

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/shot') {
    const name = (u.searchParams.get('name') || 'shot').replace(/[^a-z0-9_\-]/gi, '');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      let buf = Buffer.concat(chunks);
      const s = buf.toString('utf8');
      const i = s.indexOf('base64,');
      if (i >= 0) buf = Buffer.from(s.slice(i + 7).replace(/\s+/g, ''), 'base64');
      fs.writeFileSync(path.join(dir, name + '.jpg'), buf);
      res.end('ok ' + buf.length);
    });
    return;
  }
  if (req.method === 'POST' && u.pathname === '/log') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { fs.appendFileSync(path.join(dir, 'log.txt'), b + '\n'); res.end('ok'); });
    return;
  }
  res.writeHead(404); res.end();
}).listen(8124, '127.0.0.1', () => console.log('peek server on http://127.0.0.1:8124'));
