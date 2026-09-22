# Bitget integration status

Phase 10 is in progress. The application remains in synthetic mode until a complete real-data calibration and provenance path is accepted. Do not switch `VITE_DATA_SOURCE` to `auto` yet.

## Verified upstream contracts

The read-only probe connected to `https://agent.bitget.com/mcp`. The server enumerated `guide` and `do_query`; catalog entries, not guessed MCP tool names, select the data operation.

| Data | Verified surface | Interpretation |
| --- | --- | --- |
| rToken symbols | REST `/api/v3/market/instruments?category=SPOT` | All twenty covered names matched `baseCoin` and `isReality=yes`. Explicit mapping is in `symbolMap.ts`. |
| rToken quotes | REST `/api/v3/market/tickers` | Actual Reality token quotes, not underlying stock quotes. USDT platform turnover is distinct from base volume and external-market turnover. |
| rToken candles | REST `/api/v3/market/candles`, `/history-candles` | Array positions verified against actual responses. Quote turnover is the seventh field. Missing volume is rejected, not converted to zero. |
| Underlying daily bars | MCP `equity_price_historical` | Retrieved 750 completed bars per underlying. Partial current sessions and stale latest-close history are rejected. |
| Stock news | MCP `news_label_search`, label `stocks` | Headline and timestamp only; source HTML is discarded. Impact and confidence remain unknown until classified. |

References: [Reality guide](https://www.bitget.com/docs/uta/reality-trading-guide), [market-data contracts](https://www.bitget.com/docs/catalog/market/market-data).

## Reproduce

```bash
npm run probe:bitget
npm run audit:bitget
npm run check:betas
```

The probe writes responses under ignored `raw/probe/`. Set `KAIROS_PROBE_TOOL` and JSON `KAIROS_PROBE_ARGS` to select a read-only catalog query after reading its schema. `KAIROS_PROBE_REST=1` also captures the REST instrument, rNVDA ticker and candle responses. The audit saves live data in ignored `raw/bitget/`; it never overwrites the shipped synthetic artifacts.

No Bitget trading credentials are needed for these tested public data calls. There are no order-placement operations.

## Calibration findings and release gate

The first overly broad historical request silently stopped before its requested end date. The request now stays below the observed result cap and the provider checks that the latest official close is present.

With 250 matched sessions from 2025-09-23 through 2026-09-21, the measured gap betas were:

| Symbol | Gap beta |
| --- | ---: |
| rAAPL | 0.087 |
| rMSFT | 0.384 |
| rNVDA | 1.295 |
| rAMD | 2.640 |
| rMU | 3.336 |

An independent covariance calculation, deriving gaps afresh from open and previous close, matches the engine to numerical precision. Excluding gaps larger than five percent does not resolve the disagreement with the build plan's expected ranges. This verifies the calculation on the downloaded data, not the data against an independent vendor. The discrepancy must be resolved before treating live forecasts as accepted.

The rSPY and rQQQ instruments list June 2026 launch times. Their shorter history cannot support a claimed year of real token observations. Candle volume provenance and corporate-action adjustments also need validation before estimating real reversion buckets or replacing the Record.

## Implemented, not yet enabled in the browser

The Zod adapters throw `ProviderError` on malformed payloads. `BitgetProvider` records health per method. `FallbackProvider` falls back immediately and retries the failed method after sixty seconds. Tests cover these transitions and malformed responses. The proxy caches quote requests for twenty seconds and retains explicitly labelled saved quotes on failure.

The browser resolver is deliberately still synthetic: per-method availability alone does not make it valid to combine live prices with simulated anchors, liquidity parameters or analogs. Remaining work includes a complete real-data artifact rebuild, provenance-aware worker/resolver wiring and labels, scheduled live updates, production switching, and browser network-loss verification.
