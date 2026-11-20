# PA Position Manager V1.0

A static, mobile-first Binance public-market-data and price-action position sizing tool. No API key, backend, account connection, or order execution.

## V1.0 scope
- Binance Spot, USDⓈ-M perpetual, and `TRADIFI_PERPETUAL` market selection.
- Public REST market data; manual planned entry with live ticker display (15-second polling while the page is visible).
- Multi-timeframe selection, OHLCV retrieval, confirmed swing-point structure, HH/HL/LH/LL classification, BOS/CHoCH heuristic, simple liquidity-sweep hint, ATR(14), EMA20/50.
- Structure-first stop with ATR buffer; ATR-only and manual stop alternatives.
- R-multiple targets, position sizing, estimated round-trip fees, quantity-step and minimum-notional checks when exchange metadata provides them.
- JSON export and installable PWA shell.

## Run locally
Serve this directory over HTTP (ES modules and service workers do not work reliably from `file://`):

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy to GitHub Pages
1. Create a GitHub repository and upload the contents of this directory to its root (or configure Pages to the folder containing `index.html`).
2. In Settings → Pages, choose Deploy from a branch, select `main` and `/ (root)`.
3. Open the published HTTPS URL. No build step is required.

## Market data endpoints
- Spot: `data-api.binance.vision` (fallback `api.binance.com`) `/api/v3/exchangeInfo`, `/api/v3/ticker/price`, `/api/v3/ticker/24hr`, `/api/v3/klines`.
- USDⓈ-M: `fapi.binance.com` `/fapi/v1/exchangeInfo`, `/fapi/v1/ticker/price`, `/fapi/v1/ticker/24hr`, `/fapi/v1/premiumIndex`, `/fapi/v1/klines`.
- TradFi perpetual klines: `/fapi/v1/continuousKlines?pair=...&contractType=TRADIFI_PERPETUAL&interval=...`.

TradFi support is deliberately scoped to Binance USDⓈ-M `TRADIFI_PERPETUAL` products. The app uses the futures ticker/mark-price endpoints and continuousKlines for candles; availability and symbol naming must be verified against live exchangeInfo for each product. Not every standard futures metric is guaranteed to be available for TradFi products.

## Important limitations
- This is an analytical calculator, not a trade signal service and not an execution terminal.
- Swing points are confirmed only after `pivotStrength` bars to the right. The newest candle is excluded from structural calculations to avoid using an unfinished candle.
- BOS/CHoCH and liquidity sweep are deterministic heuristics, not a universal formal definition of market structure. V1.0 does not claim reliable Order Block or FVG detection.
- Support/resistance is the nearest confirmed pivot, not a probabilistic zone model.
- Stop distance determines size; leverage changes estimated margin, not the dollar risk. Fees are an estimate and funding/slippage are not included in stop-loss cost.
- Liquidation price is intentionally not estimated in V1.0 because maintenance-margin tiers, fee buffers, mark-price rules, and TradFi contract specifics must be modeled accurately before displaying it.
- Validate tick size, quantity step, minQty, minNotional, contract multiplier, and trading status at the exchange before any order. TradFi instruments may have different product rules.
- Browser access to Binance APIs may be restricted by network, region, CORS, or exchange availability. The UI reports errors instead of fabricating market values.

## Compatibility notes for SMI
The app keeps the same candle vocabulary (`time/open/high/low/close/volume/quoteVolume/takerBuyBase/takerBuyQuote`) and the SMI-aligned indicator naming can be added through an adapter. V1.0 is stateless: it does not persist market snapshots or user trade history.

## Safety defaults
- Default account equity: 70 USDT.
- Default risk: 1% of equity.
- Default leverage: 3x.
- Isolated margin is a manual exchange-side setting; the tool cannot enforce it.
- No API keys are requested or stored.
