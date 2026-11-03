# ASX Share Profit Calculator

A simple, large-text page that works out how much profit (or loss) you made on ASX shares.

You enter:

- **Share code** (e.g. `BHP`, `CBA`)
- **Number of shares**
- **Date bought** and **date sold**

The closing price for each date is looked up automatically (if the market was closed that day,
the last trading day before it is used). You can always type over a price yourself, for example
to use the exact price you paid. The profit, percentage change and a plain-English summary update instantly.

## Run it

Needs Node.js 18 or newer. No packages to install.

```bash
cd AsxProfitCalculator
npm start          # or: node server.js
```

Then open http://localhost:3000.

Set `PORT` to use a different port. Historical prices come from Yahoo Finance's public chart
endpoint via the small server in `server.js` (browsers can't call it directly). If a price can't be
found, the page asks you to type it in, so the calculator still works.

Brokerage fees and dividends are not included.
