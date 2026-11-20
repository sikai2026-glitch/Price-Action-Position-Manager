# PA Position Manager — Technical Specification V1.0

## 1. Product objective
A GitHub Pages-hosted, mobile-first decision-support tool for Binance Spot, USDⓈ-M perpetuals, and USDⓈ-M `TRADIFI_PERPETUAL`. It combines manually specified planned entry with live market data, deterministic price-action structure analysis, structure-first stop placement with ATR buffer, R-based targets, and risk-budget-driven position sizing.

## 2. Non-goals
No account authentication, private endpoints, API-key storage, order placement, automated trade execution, portfolio synchronization, persistent snapshot database, or claims of guaranteed profitability.

## 3. User workflow
1. Select market class and symbol.
2. Fetch public ticker and exchange metadata.
3. Enter side, planned entry, account equity, risk %, leverage, fee rate.
4. Fetch 300 candles for selected timeframe; exclude the currently open candle for structure analysis.
5. Calculate confirmed pivots, swing classification, trend heuristic, BOS/CHoCH heuristic, liquidity sweep hint, ATR and EMA context.
6. Generate stop from latest confirmed swing ± ATR buffer (or ATR/manual mode).
7. Generate TP1/TP2/TP3 at 1.5R/2.5R/3.5R, capped by the nearest opposing pivot for TP3; allow manual TP1/TP2 override.
8. Calculate quantity/notional/margin and exchange-rule checks.
9. Export a JSON plan.

## 4. Market data
### Spot
`GET https://data-api.binance.vision/api/v3/exchangeInfo`
`GET /api/v3/ticker/price?symbol=...`
`GET /api/v3/ticker/24hr?symbol=...`
`GET /api/v3/klines?symbol=...&interval=...&limit=300`

### USDⓈ-M perpetual
`GET https://fapi.binance.com/fapi/v1/exchangeInfo`
`GET /fapi/v1/ticker/price?symbol=...`
`GET /fapi/v1/premiumIndex?symbol=...`
`GET /fapi/v1/ticker/24hr?symbol=...`
`GET /fapi/v1/klines?symbol=...&interval=...&limit=300`

### TradFi perpetual
Use USDⓈ-M exchange metadata and restrict market type to `TRADIFI_PERPETUAL`; candle request uses `/fapi/v1/continuousKlines` with `pair`, `contractType=TRADIFI_PERPETUAL`, `interval`, and `limit`. Symbol and ticker availability must be checked per listed product. Unsupported data remains null/unavailable, never synthesized.

## 5. Normalized candle schema
`{time, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote}`.
This schema is compatible with SMI-style market snapshots and supports downstream indicator calculation.

## 6. Price-action rules
- Pivots: a candle is a swing high/low only if its high/low is strictly more extreme than `strength` candles on both sides. This means a pivot is confirmed with a delay.
- Trend heuristic: compare the last two confirmed swing highs and lows. HH+HL => bullish; LH+LL => bearish; mixed pairs => mixed; otherwise range/unconfirmed.
- BOS/CHoCH: latest closed candle close beyond the latest confirmed swing high/low. The previous trend heuristic determines BOS versus CHoCH label.
- Liquidity sweep hint: latest closed candle wicks beyond the prior confirmed swing and closes back inside.
- ATR: Wilder ATR(14).
- EMA context: EMA20 and EMA50.
- Support/resistance: nearest confirmed pivot below/above latest close.

These are explicit, testable heuristics; they are not a claim that a single canonical market-structure definition exists. V1.0 does not automatically identify OB/FVG.

## 7. Risk calculation
- Risk budget = equity × riskPct / 100.
- Stop distance = absolute(entry - stop).
- Estimated round-trip fee allowance = 2 × feeRate × notional.
- Notional = riskBudget / (stopDistance/entry + 2×feeRate).
- Quantity = notional / entry, rounded down to exchange quantity step.
- Actual stop cost = quantity × stopDistance + estimated round-trip fees.
- Futures initial margin estimate = notional / leverage; Spot cash requirement = notional.
- Validate status, minQty, qtyStep, minNotional when exchange filters expose them.
- Funding and slippage are not included in V1.0; user should allow additional risk buffer.

## 8. Architecture
Static ES modules: API adapters → normalized candles → indicators → price-action engine → stop/target engine → position risk engine → JSON plan. GitHub Pages requires no build process. Service worker caches static assets only; Binance API responses are not persisted.

## 9. Error handling
Timeouts, HTTP errors, unavailable symbols, malformed inputs, insufficient candles, invalid stop direction, minQty/minNotional violations, and failed clipboard operations must surface in the UI. Missing fields are null/unknown, not fabricated.

## 10. Acceptance criteria
- Loads without build step on a static HTTPS origin.
- No API key or private account access.
- Market switch changes correct public API route.
- Planned entry remains independent of live ticker refresh.
- Structure calculation excludes current open candle.
- Long stop must be below entry; short stop above entry.
- Quantity rounds down to step size.
- Min quantity and min notional violations block admission.
- JSON export contains source timestamp and calculation assumptions.
- No order execution functionality exists.
