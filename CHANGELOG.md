# Changelog

## V1.0.2
- Added conditional trade-management playbook even when entry admission is rejected.
- Added 40/35/25 staged exits, post-TP1 break-even protection, post-TP2 confirmed-pivot trailing, opposing-structure early-exit review, and pre-entry invalidation rules.
- Added minimum-tradable-lot diagnostics for stop cost, margin, risk feasibility and estimated required equity.
- Fixed `marginSufficient` so a zero-sized position cannot pass solely because it consumes no margin.
- Added JSON management and minimum-order feasibility output; bumped service-worker cache.

## V1.0.1
- Added pivot invalidation and valid protective structure stops.
- Added separate R-multiple and structural targets.
- Added risk + collateral constrained position sizing, costs, and admission checks.
- Added conservative price rounding, documentation, and automated tests.
