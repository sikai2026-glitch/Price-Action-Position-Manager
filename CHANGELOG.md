# Changelog

## 1.0.1 — Risk and structure integrity
- Reject structure stops when the required swing pivot is absent, already invalidated by a later close, or on the wrong side of planned entry.
- Mark pivots invalid after a later closed candle closes through them; wick-only breaches remain non-invalidating.
- Separate R-multiple targets from structural targets and flag intervening structure instead of silently clipping targets.
- Constrain sizing by both risk budget and collateral budget, reserve 20% of equity by default, and recalculate fees/slippage/funding after quantity rounding.
- Add explicit one-way fee, round-trip slippage, holding-period funding and margin-utilization assumptions.
- Add APPROVED / CAUTION / REJECTED admission output with reasons and warnings.
- Add regression tests for the previously observed BTC long setup with no valid protective swing low.
