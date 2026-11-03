// Netlify Function: GET /api/price?code=BHP&date=2024-01-05
const { priceResponse } = require('../../lib/price');

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const { status, body } = await priceResponse(q.code, q.date);
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Historical closes don't change; let the CDN cache successful answers.
      'Cache-Control': status === 200 ? 'public, max-age=86400' : 'no-store',
    },
    body: JSON.stringify(body),
  };
};
