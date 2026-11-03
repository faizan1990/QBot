// ASX Profit Calculator - tiny zero-dependency server.
// Serves the page in ./public and looks up historical ASX closing prices
// (browsers can't call the price source directly because of CORS).
//
//   node server.js            -> http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const { lookupPrice, priceResponse } = require('./lib/price');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function handlePrice(req, res, query) {
  const { status, body } = await priceResponse(query.get('code'), query.get('date'));
  sendJson(res, status, body);
}

function serveStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, contents) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(contents);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }
  if (url.pathname === '/api/price') return handlePrice(req, res, url.searchParams);
  serveStatic(req, res, decodeURIComponent(url.pathname));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`ASX Profit Calculator running at http://localhost:${PORT}`));
}

module.exports = { server, lookupPrice };
