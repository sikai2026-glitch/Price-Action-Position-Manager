# PA Position Manager V1.0.4

A static Binance price-action position sizing and risk-management tool supporting USDT-quoted USDⓈ-M perpetual, Spot and TradFi perpetual markets. It uses public market data only: no API key, backend, account connection, or order execution.

## Scope
- Supports Binance USDⓈ-M (USDT-M) standard perpetual, USDT-quoted Spot, and TradFi perpetual markets. USDⓈ-M is selected by default.
- COIN-M inverse contracts and non-USDT quote/settlement products are excluded. Spot reserves the full USDT notional and ignores leverage; TradFi contract filters and margin tiers may require manual verification.
- Manual planned entry, manually entered account equity (no default balance), editable leverage (1x–125x), and live public ticker/mark-price display.
- OHLCV structure analysis, confirmed swing points, HH/HL/LH/LL, BOS/CHoCH heuristic, liquidity-sweep hint, ATR(14), EMA20/50.
- Structure-first stop with ATR buffer; broken pivots cannot be used as stop anchors. ATR-only and manual stop alternatives remain available.
- Structure-aware take profits: a confirmed, still-valid opposing pivot clips the corresponding R objective when it lies before that objective; otherwise the target uses 1.5R / 2.5R / 3.5R. Manual TP1/TP2 can override only if direction and ordering remain valid.
- Position sizing constrained by both risk budget and USDT collateral budget; quantity-step rounding and all cost estimates are recalculated.
- Exchange-valid partial exit allocations. If the position is too small for three minimum exit orders, the app consolidates exits into the number of valid tranches instead of displaying impossible zero-size orders as executable.
- Explicit open/close fee, round-trip slippage and holding-period funding allowances; configurable margin utilization (default 80%).
- Rule-based admission result: APPROVED / CAUTION / REJECTED with reasons and warnings; conditional management rules remain visible when rejected.
- JSON export and installable PWA shell.

## Run locally
Serve this directory over HTTP (ES modules and service workers do not work reliably from `file://`):

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy to GitHub Pages
1. Upload the contents of this directory to the repository root (or configure Pages to the folder containing `index.html`).
2. In Settings → Pages, choose Deploy from a branch, select `main` and `/ (root)`.
3. Open the published HTTPS URL. No build step is required.

## Market data endpoints
Market-aware public endpoints are used:
- USDⓈ-M: `/fapi/v1/exchangeInfo`, `/fapi/v1/ticker/price`, `/fapi/v1/ticker/24hr`, `/fapi/v1/premiumIndex`, `/fapi/v1/klines`.
- Spot: `/api/v3/exchangeInfo`, `/api/v3/ticker/price`, `/api/v3/ticker/24hr`, `/api/v3/klines`.
- TradFi: `/fapi/v1/continuousKlines` with `contractType=TRADIFI_PERPETUAL`; latest 1-minute close is used as a reference price.

Symbols must be USDT-quoted. USDⓈ-M metadata is checked for USDT quote/margin and standard `PERPETUAL`; Spot metadata is checked for USDT quote. TradFi exchange filters are not automatically validated. No `/dapi` COIN-M endpoints are called.

## Risk model
Let `R` be risk budget, `d` stop distance as a fraction of entry, `f` one-way fee rate, `s` round-trip slippage allowance, and `u` holding-period funding allowance.

`riskNotional = R / (d + 2f + s + u)`

`capitalBudget = equity × marginUtilization`

`initialMargin = notional / leverage` (USDⓈ-M and TradFi; Spot uses full notional)

`collateralPerNotional = 1/leverage + 2f + u` (Spot: leverage is fixed to 1)

`marginNotional = capitalBudget / collateralPerNotional`

`rawNotional = min(riskNotional, marginNotional)`

Quantity is rounded down to the exchange step. Stop loss, open/close fees, slippage and funding are recomputed after rounding. The account equity field is intentionally blank on first load and must be entered by the user. Leverage is an editable numeric field from 1x to 125x.

Fees are approximations based on the entered rate; closing fee may differ with exit price and maker/taker execution. Funding is a user-entered holding-period allowance, not a forecast. Slippage is a user-entered round-trip allowance.

## Take-profit model
- Baseline objectives are 1.5R, 2.5R and 3.5R, where `1R = abs(entry - stop)`.
- For each R boundary, the first still-valid opposing pivot encountered from the entry toward the target is selected (nearest in price order, not the farthest pivot in the interval). Nearby/duplicate pivot prices are clustered using tick size and ATR tolerance.
- An R fallback is used only when it is positive and preserves target ordering. Non-positive R results are skipped; missing tiers stay empty rather than producing negative or fabricated prices.
- Manual TP1/TP2 override the corresponding calculated target only if they preserve direction and target ordering.
- Broken pivots are excluded as untouched structural targets because price has already closed through them.

## Position management
- Default intended scale-out proportions are 40/35/25, but actual quantities are rounded to exchange step and each active exit must satisfy minimum quantity.
- If the position supports only one valid exit lot, the entire position is allocated to TP1. If it supports two, the plan uses two valid exits. It never pretends that a 0.001 BTC position can be split into three 0.0004/0.00035/0.00025 BTC orders when the exchange minimum is 0.001 BTC.
- After TP1, review moving the remaining stop toward break-even plus estimated cost buffer. After TP2, trail behind newly confirmed protective pivots. Opposing close-confirmed CHoCH/BOS triggers an early-exit review.
- These are conditional rules requiring manual confirmation. The app does not track fills, monitor open positions, move stops, or execute orders.

## Important limitations
- This is an analytical calculator, not a trade signal service or execution terminal.
- Swing points are confirmed only after `pivotStrength` bars to the right. The newest candle is excluded from structural calculations.
- BOS/CHoCH and liquidity sweep are deterministic heuristics, not universal formal definitions. OB/FVG are not automatically detected.
- Stop distance determines size; leverage changes estimated initial margin, not the dollar loss at the stop.
- Liquidation price is intentionally not estimated because maintenance-margin tiers and mark-price mechanics need a separately validated model.
- Verify current exchange filters, fees, funding, slippage, and margin tiers before any order. API availability, CORS, region and network restrictions may affect live data.

## Compatibility notes for SMI
The app keeps the SMI-aligned candle vocabulary (`time/open/high/low/close/volume/quoteVolume/takerBuyBase/takerBuyQuote`). V1.0.4 is stateless and does not persist snapshots or trade history.
