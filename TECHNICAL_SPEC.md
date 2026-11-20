# PA Position Manager — Technical Specification V1.0.3

## 1. Product objective
A static decision-support tool for Binance USDⓈ-M / USDT-M standard perpetual contracts only. It combines manually entered planned entry and account equity with public ticker/mark-price data, price-action structure analysis, structure-aware stop/target logic, USDT-denominated risk sizing, and conditional position-management rules.

## 2. Supported and excluded products
- Supported: Binance USDⓈ-M standard perpetual contracts with `quoteAsset=USDT`, USDT margin/settlement, and `contractType=PERPETUAL`.
- Excluded: Binance COIN-M inverse contracts (`/dapi`), spot, TradFi perpetual products, delivery futures, and non-USDT settlement products.
- Symbol validation requires a `USDT` suffix, followed by exchangeInfo validation. All margin and PnL estimates are denominated in USDT.

## 3. Non-goals
No account authentication, private endpoints, API-key storage, order placement, automated execution, portfolio synchronization, persistent snapshot database, liquidation-price estimates, or guaranteed-profit claims.

## 4. Workflow
1. The market type is fixed to Binance USDⓈ-M / USDT-M perpetual. Enter a USDT-quoted symbol.
2. Enter direction, planned entry, account equity in USDT, risk %, leverage (editable 1x–125x), fees, margin utilization, slippage and funding assumptions. Equity has no default value and is required for calculation.
3. Retrieve up to 300 `/fapi/v1/klines` candles; exclude the still-open final candle.
4. Identify confirmed pivots, HH/HL/LH/LL, trend, close-confirmed BOS/CHoCH, sweep hints, ATR and EMA context.
5. Mark pivots invalid if a later closed candle closes through them. Only unbroken protective pivots on the correct side of planned entry can anchor structure stops.
6. Apply ATR buffer and exchange price tick rounding. If no valid structural anchor exists, do not fabricate a stop.
7. Calculate R objectives at 1.5R/2.5R/3.5R. For each objective, use the nearest still-valid opposing pivot lying between entry and the R objective as the actual TP level; otherwise retain the R objective. Manual TP1/TP2 override only when direction and monotonic order remain valid.
8. Calculate position size from the lower of risk-budget capacity and USDT collateral capacity, round quantity down, then recompute costs.
9. Allocate exit quantities using exchange step and minimum quantity. Consolidate into one or two valid exits if the position cannot support three minimum-size orders.
10. Apply admission checks and export JSON with explicit USDT-M product metadata, target calculation method, reasons and warnings.

## 5. Price-action definitions
- Pivot high/low: strictly more extreme than `strength` candles on both sides; confirmation is delayed until right-side candles exist.
- Pivot invalidation: a later closed candle closes above a pivot high or below a pivot low. Wick-only breaches do not invalidate a pivot.
- Trend heuristic: last two confirmed highs and lows; HH+HL bullish, LH+LL bearish, mixed pairs mixed, otherwise range.
- BOS/CHoCH: latest closed candle crosses the most recent confirmed pivot on a closing basis; opposite-to-prior-trend break is labeled CHoCH, otherwise BOS.
- Long protective stop anchor: latest unbroken confirmed swing low below planned entry. Short protective stop anchor: latest unbroken confirmed swing high above planned entry.
- Structural take-profit candidates: still-valid confirmed pivot highs above a long entry, or pivot lows below a short entry. Already-broken pivots are excluded.
- Liquidity sweep hint: latest closed candle wicks beyond the prior confirmed pivot and closes back inside.
- ATR: ATR(14); default structure buffer is 0.2 ATR. Stop distance below 0.1 ATR or above 4 ATR generates a warning.
- OB/FVG are not automatically inferred.

## 6. USDT-M risk model
Let `R` be risk budget, `d` stop distance as a fraction of entry, `f` one-way fee rate, `s` round-trip slippage allowance, and `u` holding-period funding allowance.

`riskNotional = R / (d + 2f + s + u)`

`capitalBudget = equityUSDT × marginUtilization`

`initialMarginUSDT = notionalUSDT / leverage`

`collateralPerNotional = 1/leverage + 2f + u`

`marginNotional = capitalBudget / collateralPerNotional`

`rawNotional = min(riskNotional, marginNotional)`

Quantity is rounded down to the exchange step. Gross stop loss, open/close fees, slippage, funding, initial margin and reserved capital are recomputed after rounding. All amounts are USDT. Leverage changes estimated margin, not the stop-loss amount for a fixed quantity and stop distance.

## 7. Targets
- Baseline targets: 1.5R, 2.5R and 3.5R, where `1R = abs(entry - stop)`.
- Each baseline target is clipped to the nearest still-valid opposing pivot that lies between entry and that baseline objective. This treats the confirmed pivot as a real structural barrier rather than silently assuming price will pass through it.
- If no eligible structure pivot exists, the corresponding R target is retained. The result explicitly reports that it used the R formula because no valid structure target was available.
- Manual TP1/TP2 override the corresponding calculated level only if they preserve direction and target ordering.

## 8. Exchange-valid scale-out allocation
- Intended policy weights are 40/35/25.
- Active exits are limited by total quantity, quantity step and `minQty`.
- If only one minimum exit lot is available, 100% is assigned to TP1; if two are available, two valid tranches are used. The engine never displays impossible partial quantities as executable.
- When the plan is rejected, only conditional percentage guidance is displayed; executable quantities remain absent.

## 9. Admission and management
`REJECTED` for invalid/missing stop, opposing BOS/CHoCH, failed position/exchange/collateral checks, missing targets, or insufficient structural room. `CAUTION` for trend conflict, no confirming break, missing exchange metadata, entry drift >0.5%, or stop-quality warnings. Admission is a checklist, not a prediction.

A management playbook is emitted even for rejected entries but is labeled `CONDITIONAL_ONLY`. It includes initial protection, staged exits, TP1 break-even review, TP2 structure trailing, opposing-structure early-exit review, and pre-entry invalidation. It does not monitor fills or execute actions.

## 10. Market data and architecture
Only Binance USDⓈ-M Futures endpoints are used: `/fapi/v1/exchangeInfo`, `/fapi/v1/ticker/price`, `/fapi/v1/ticker/24hr`, `/fapi/v1/premiumIndex`, `/fapi/v1/klines`. No `/dapi` COIN-M endpoints are called.

Static ES modules: API adapter → normalized candles → indicators → price-action engine → stop/target engine → USDT-M risk engine → admission/management engine → JSON plan. GitHub Pages requires no build step.

## 11. Known limitations
- Public API availability, CORS, region and network restrictions may affect live data.
- Pivot and BOS/CHoCH rules are heuristics, not canonical SMC interpretation.
- No liquidation price: maintenance-margin tiers and mark-price mechanics require a separately validated model.
- Fee, slippage and funding are user-provided estimates, not exchange quotes or forecasts.
- No trade execution, account connection, open-position tracking, fill tracking or automatic stop movement.

## 12. Acceptance criteria
- Only standard Binance USDT-M perpetual symbols are accepted; non-USDT and COIN-M products are rejected.
- Account equity is blank on first load and required before calculation.
- Leverage is manually editable.
- Open candle excluded; broken pivots cannot anchor stops or serve as untouched structural targets.
- Structural target clipping and R-multiple fallback are reported explicitly.
- Position size constrained by risk and USDT collateral; actual costs recomputed after quantity rounding.
- Partial exits always obey quantity step and minimum quantity.
- Admission reasons/warnings and assumptions are included in JSON.
