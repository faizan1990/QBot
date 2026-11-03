// ASX Profit Calculator - tiny zero-dependency server.
// Serves the page in ./public and looks up historical ASX closing prices
// (browsers can't call the price source directly because of CORS).
//
//   node server.js            -> http://localhost:3000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PRICE_SOURCE = process.env.PRICE_SOURCE || 'https://query1.finance.yahoo.com';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DAY = 24 * 60 * 60;

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

// Formats a unix timestamp as YYYY-MM-DD in the exchange's local time.
function localDate(ts, gmtOffset) {
  return new Date((ts + gmtOffset) * 1000).toISOString().slice(0, 10);
}

// Returns the closing price on `date`, or on the last trading day before it
// (weekends and public holidays have no trading).
async function lookupPrice(code, date) {
  const target = Date.parse(date + 'T00:00:00Z') / 1000;
  const period1 = target - 14 * DAY;
  const period2 = target + 2 * DAY;
  const url = `${PRICE_SOURCE}/v8/finance/chart/${encodeURIComponent(code + '.AX')}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=split`;

  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (ASX Profit Calculator)' } });
  if (response.status === 404) return { error: 'not_found' };
  if (!response.ok) throw new Error(`Price source replied ${response.status}`);

  const data = await response.json();
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) return { error: 'not_found' };

  const meta = result.meta || {};
  const offset = meta.gmtoffset || 0;
  const timestamps = result.timestamp || [];
  const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] &&
    result.indicators.quote[0].close) || [];

  let best = null;
  for (let i = 0; i < timestamps.length; i++) {
    const day = localDate(timestamps[i], offset);
    if (day <= date && closes[i] != null) best = { day, close: closes[i] };
  }
  if (!best) return { error: 'no_price' };

  return {
    code,
    name: meta.longName || meta.shortName || code,
    requestedDate: date,
    tradingDate: best.day,
    close: Math.round(best.close * 1000) / 1000,
    currency: meta.currency || 'AUD',
  };
}

async function handlePrice(req, res, query) {
  const code = String(query.get('code') || '').trim().toUpperCase().replace(/\.AX$/, '');
  const date = String(query.get('date') || '');

  if (!/^[A-Z0-9]{1,6}$/.test(code)) return sendJson(res, 400, { error: 'bad_code' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return sendJson(res, 400, { error: 'bad_date' });

  try {
    const result = await lookupPrice(code, date);
    sendJson(res, result.error ? 404 : 200, result);
  } catch (err) {
    console.error('Price lookup failed:', err.message);
    sendJson(res, 502, { error: 'unavailable' });
  }
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
