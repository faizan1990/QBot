// Looks up historical ASX closing prices from Yahoo Finance.
// Shared by server.js (local / any Node host) and the Netlify function.

const PRICE_SOURCE = process.env.PRICE_SOURCE || 'https://query1.finance.yahoo.com';
const DAY = 24 * 60 * 60;

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

// Validates the query and returns { status, body } ready to send as JSON.
async function priceResponse(rawCode, rawDate) {
  const code = String(rawCode || '').trim().toUpperCase().replace(/\.AX$/, '');
  const date = String(rawDate || '');

  if (!/^[A-Z0-9]{1,6}$/.test(code)) return { status: 400, body: { error: 'bad_code' } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return { status: 400, body: { error: 'bad_date' } };

  try {
    const result = await lookupPrice(code, date);
    return { status: result.error ? 404 : 200, body: result };
  } catch (err) {
    console.error('Price lookup failed:', err.message);
    return { status: 502, body: { error: 'unavailable' } };
  }
}

module.exports = { lookupPrice, priceResponse };
