# PA Position Manager V1.0.2

A static, mobile-first Binance public-market-data and price-action position sizing tool. No API key, backend, account connection, or order execution.

## Scope
- Binance Spot, USDⓈ-M perpetual, and `TRADIFI_PERPETUAL` market selection.
- Public REST market data; manual planned entry with live ticker display (15-second polling while the page is visible).
- Multi-timeframe selection, OHLCV retrieval, confirmed swing-point structure, HH/HL/LH/LL classification, BOS/CHoCH heuristic, simple liquidity-sweep hint, ATR(14), EMA20/50.
- Structure-first stop with ATR buffer; broken pivots cannot be used as stop anchors. ATR-only and manual stop alternatives remain available.
- Separate R-multiple and structural targets, with structure-obstacle warnings.
- Position sizing constrained by both risk budget and collateral budget; quantity-step rounding is followed by a full cost recalculation.
- Explicit open/close fee, round-trip slippage and holding-period funding allowances; configurable margin utilization (default 80%).
- Rule-based admission result: APPROVED / CAUTION / REJECTED with reasons and warnings.
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

## V1.0.2 risk-model notes
- Structure stop requires the latest unbroken confirmed swing low below planned entry for LONG, or swing high above planned entry for SHORT. If none exists, no stop is fabricated and admission is rejected.
- Default collateral utilization is 80%; the remainder is reserved rather than consumed as initial margin.
- Fee is entered as a one-way rate; estimated round-trip fees are 2 × fee rate × entry notional. Slippage is a round-trip percentage; funding is a user-entered holding-period percentage. These are estimates, not exchange quotes.
- R targets remain separate from structural targets. A nearby opposing structure is flagged rather than silently altering the R multiple.

## Important limitations
- This is an analytical calculator, not a trade signal service and not an execution terminal.
- Swing points are confirmed only after `pivotStrength` bars to the right. The newest candle is excluded from structural calculations to avoid using an unfinished candle.
- BOS/CHoCH and liquidity sweep are deterministic heuristics, not a universal formal definition of market structure. V1.0.2 does not claim reliable Order Block or FVG detection.
- Support/resistance is the nearest confirmed pivot, not a probabilistic zone model.
- Stop distance determines size; leverage changes estimated margin, not the dollar risk. Fees, slippage and funding are explicit estimates and are included in the modeled stop-cost budget.
- Liquidation price is intentionally not estimated in V1.0.1 because maintenance-margin tiers, fee buffers, mark-price rules, and TradFi contract specifics must be modeled accurately before displaying it.
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

## V1.0.2 trade-management output
- A rejected entry still produces a conditional management playbook; rejection no longer suppresses all post-entry guidance.
- Default scale-out model: TP1 40%, TP2 35%, TP3 remaining 25%. Quantities are shown only when admission is APPROVED and the rounded position is executable.
- After TP1, the playbook proposes moving the remaining stop toward break-even with a fee/slippage buffer; after TP2, it proposes trailing behind newly confirmed protective pivots. These are conditional rules requiring manual confirmation, not automatic orders.
- A close-confirmed opposing CHoCH/BOS is an early-exit review trigger. A broken pre-entry stop anchor invalidates the plan.
- Minimum tradable quantity/notional is evaluated separately from the risk-sized quantity. The result includes minimum-lot estimated stop cost, collateral requirement, feasibility, and approximate equity needed under the same assumptions. This is diagnostic only, never a recommendation to add funds or increase risk.
- `marginSufficient` now evaluates the minimum executable lot when the calculated quantity is zero; it can no longer pass merely because zero quantity consumes zero margin.

## V1.0.2 limitations
The 40/35/25 exit split and break-even/trailing rules are configurable policy defaults, not statistically validated optimal parameters. The app does not monitor an open position, detect fills, or move stops automatically. Actual partial quantities must be recalculated against exchange step size and remaining position after each fill.
