## V1.0.4

- Restored USDT-quoted Spot and TradFi perpetual choices; USDⓈ-M perpetual remains the default market.
- Restored market-aware ticker/Kline routes; Spot sizing reserves full USDT notional and does not apply leverage.
- Rebuilt take-profit ladder to choose the nearest valid opposing structure level at each R boundary (not the farthest level).
- Non-positive R targets are skipped; missing targets remain empty rather than inventing negative prices.
- Added regression tests using the uploaded MMTUSDT example.

# Changelog

## V1.0.3
- Locked the product to Binance USDⓈ-M (USDT-M) perpetual contracts only; removed spot and TradFi market choices and rejected non-USDT / non-standard perpetual symbols.
- Added explicit USDT margin, quote and settlement metadata to calculations and JSON output; COIN-M inverse contracts are out of scope.
- Removed the default 70 USDT account equity. Equity must be entered manually before a plan can be calculated.
- Changed leverage to a manually editable numeric input (1x–125x).
- Made take-profit selection structure-first: confirmed, still-valid opposing pivots clip the corresponding R-multiple objectives; when no valid structural level exists, the engine explicitly falls back to 1.5R / 2.5R / 3.5R.
- Added explicit target method, structural target candidates and final TP prices to the calculation detail table and JSON.
- Fixed staged exit quantities so a position smaller than three minimum exit lots is consolidated into the number of exchange-valid tranches instead of generating impossible zero-quantity TP orders.
- Bumped service-worker cache and app version.

## V1.0.2
- Added conditional trade-management playbook even when entry admission is rejected.
- Added staged exits, post-TP1 break-even protection, post-TP2 confirmed-pivot trailing, opposing-structure early-exit review, and pre-entry invalidation rules.
- Added minimum-tradable-lot diagnostics for stop cost, margin, risk feasibility and estimated required equity.
- Fixed `marginSufficient` so a zero-sized position cannot pass solely because it consumes no margin.

## V1.0.1
- Added pivot invalidation and valid protective structure stops.
- Added separate R-multiple and structural targets.
- Added risk + collateral constrained position sizing, costs, and admission checks.
- Added conservative price rounding, documentation, and automated tests.
