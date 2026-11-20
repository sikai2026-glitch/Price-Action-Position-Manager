# PA Position Manager — Technical Specification V1.0.2

## 1. Product objective
A static, mobile-first decision-support tool for Binance Spot, USDⓈ-M perpetuals, and USDⓈ-M `TRADIFI_PERPETUAL`. It combines a manually specified planned entry with live public market data, deterministic price-action structure analysis, structure-first stops with ATR buffers, separate R-multiple and structural targets, and risk sizing constrained by both loss budget and available collateral.

## 2. Non-goals
No account authentication, private endpoints, API-key storage, order placement, automated execution, portfolio synchronization, persistent snapshot database, liquidation-price estimates, or guaranteed-profit claims.

## 3. Workflow
1. Select market and symbol; retrieve ticker and exchange filters.
2. Enter direction, planned entry, equity, risk %, leverage, fee, margin utilization, slippage and funding allowances.
3. Retrieve up to 300 OHLCV candles; exclude the still-open final candle.
4. Identify confirmed pivots, HH/HL/LH/LL, trend, close-confirmed BOS/CHoCH, sweep hints, ATR and EMA context.
5. Mark pivots invalid if a later closed candle closes through them. Only unbroken protective pivots on the correct side of planned entry can anchor structure stops.
6. Apply ATR buffer and exchange price tick rounding. If no valid structural anchor exists, do not fabricate a stop; return a rejected admission result.
7. Calculate R-multiple targets independently from structural targets. Flag structural obstacles; do not silently move R targets to arbitrary prices.
8. Calculate position size from the lower of risk-budget capacity and collateral capacity, round quantity down, then recompute actual costs.
9. Apply hard admission checks and export a JSON plan, including reasons and warnings.

## 4. Price-action definitions
- Pivot high/low: strictly more extreme than `strength` candles on both sides; confirmation is delayed until right-side candles exist.
- Pivot invalidation: a later closed candle closes above a pivot high or below a pivot low. Wick-only breaches do not invalidate a pivot in this version.
- Trend heuristic: last two confirmed highs and lows; HH+HL bullish, LH+LL bearish, mixed pairs mixed, otherwise range.
- BOS/CHoCH: latest closed candle crosses the most recent confirmed pivot on a closing basis; opposite-to-prior-trend break is labeled CHoCH, otherwise BOS. This is a deterministic heuristic, not a universal definition.
- Long protective stop anchor: latest unbroken confirmed swing low below planned entry. Short protective stop anchor: latest unbroken confirmed swing high above planned entry.
- Support/resistance: nearest unbroken confirmed pivot relative to latest closed price.
- Liquidity sweep hint: latest closed candle wicks beyond the prior confirmed pivot and closes back inside.
- ATR: ATR(14); default structure buffer is 0.2 ATR. Stop distance below 0.1 ATR or above 4 ATR generates a warning.
- OB/FVG are not automatically inferred in V1.0.1.

## 5. Risk model
Let `R` be risk budget, `d` stop distance as a fraction of entry, `f` one-way fee rate, `s` round-trip slippage allowance, and `u` funding allowance over intended holding period.

`riskNotional = R / (d + 2f + s + u)`

`capitalBudget = equity × marginUtilization`

`collateralPerNotional = (spot ? 1 : 1/leverage) + 2f + u`

`marginNotional = capitalBudget / collateralPerNotional`

`rawNotional = min(riskNotional, marginNotional)`

Quantity is rounded down to exchange step. Stop loss, open/close fees, slippage and funding allowance are recomputed after rounding. Admission fails on trading status, minQty, minNotional, risk-budget excess, zero quantity, or reserved collateral above budget. Default margin utilization is 80%, leaving a collateral reserve.

Fees are approximations based on user-entered rate and entry notional; close fee can differ with exit price and maker/taker execution. Funding is a user-entered holding-period allowance, not a live forecast. Slippage is a user-entered round-trip percentage allowance.

## 6. Targets
- R targets: 1.5R, 2.5R, 3.5R (or valid manual TP1/TP2 overrides).
- Structural targets: confirmed pivots in the favorable direction from planned entry.
- R targets remain visible and are not silently clipped. `blockedByStructure` flags when a structural level lies before an R target. If the nearest structural target offers less than 1.5R, admission is rejected for insufficient structure space.

## 7. Admission
`REJECTED` for invalid/missing stop, opposing BOS/CHoCH, failed position/exchange/collateral checks, missing targets, or insufficient structural room. `CAUTION` for trend conflict, no confirming break, missing exchange metadata, entry drift >0.5%, or stop-quality warnings. `APPROVED` only when no rejection reasons or warnings remain. Admission is a rule-based checklist, not a prediction.

## 8. Market data and architecture
Static ES modules: API adapters → normalized candles → indicators → price-action engine → stop/target engine → risk engine → admission engine → JSON plan. GitHub Pages needs no build. Service worker caches static files only.

Spot endpoints: `exchangeInfo`, `ticker/price`, `ticker/24hr`, `klines`. USDⓈ-M endpoints: `exchangeInfo`, `ticker/price`, `premiumIndex`, `ticker/24hr`, `klines`. TradFi perpetual candles use `/fapi/v1/continuousKlines` with `contractType=TRADIFI_PERPETUAL`.

## 9. Known limitations
- Public API availability, CORS, symbol mapping, and TradFi ticker support depend on Binance product availability and region.
- Pivot and BOS/CHoCH rules are explicit heuristics; no claim of canonical SMC interpretation.
- No liquidation price: maintenance-margin tiers, mark-price mechanics and product-specific contract multipliers require a separately validated model.
- Contract multiplier/quantity semantics for every TradFi instrument must be verified before using position sizing on that instrument.
- No trade execution. Verify exchange filters and actual fees before placing any order.

## 10. Acceptance criteria
- Static HTTPS deployment; no API key or backend.
- Manual entry remains independent of live ticker updates.
- Open candle excluded from structure calculations.
- Broken pivots cannot anchor structure stops.
- Invalid structure stop yields no fabricated price and blocks admission.
- Price tick and quantity step rounding are applied conservatively.
- Position size is constrained by both risk and collateral budgets.
- Actual rounded quantity costs are recalculated.
- R targets and structural targets are separately reported.
- Admission reasons/warnings and calculation assumptions are included in JSON.

## 11. V1.0.2 minimum-lot feasibility and management plan
- Compute `minimumTradableQty = ceilToStep(max(minQty, minNotional / entry))` when exchange filters are available.
- Estimate the minimum lot's gross stop loss, round-trip fees, slippage, funding, initial margin and reserved capital. Compare stop cost with the user's risk budget and reserved capital with the collateral budget independently.
- Estimate the equity required for the minimum lot as the larger of (minimum-lot total stop cost / risk fraction) and (minimum-lot reserved capital / margin utilization). This is a diagnostic under current assumptions, not a funding recommendation.
- If calculated quantity is zero, `marginSufficient` is evaluated against the minimum tradable lot rather than the zero-sized position. The admission result remains REJECTED when risk, margin, exchange filters or quantity checks fail.
- A management playbook is emitted even for REJECTED entries, but is labeled `CONDITIONAL_ONLY` and has no executable partial quantities. It never overrides admission.
- Default scale-out proportions are TP1 40%, TP2 35%, TP3 25% of the initial position (TP3 receives rounding remainder). After TP1, review moving the remaining stop to break-even plus estimated cost buffer. After TP2, trail behind newly confirmed protective pivots with ATR buffer. Opposing close-confirmed CHoCH/BOS triggers an early-exit review. Broken pre-entry structure invalidates the plan.
- These management defaults are rule templates, not backtested optimal parameters. The app does not track fills or execute orders; manual recalculation is required after partial exits.
