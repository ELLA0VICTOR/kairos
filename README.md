# Kairos

A research workbench for tokenized US stocks during the dark window. The Phase 0-4 checkpoint includes foundations, the New York calendar, the deterministic synthetic provider, the pure quantitative engine, and the offline artifact pipeline. Product screens and external integrations are later phases.

All data at this checkpoint is **synthetic**. No Bitget or Qwen calls are made. The forward ledger is also simulated: its `live` origin describes when the forecast was logged, not the provenance of its prices. Every artifact carries `source: synthetic`.

## Run

Requires Node 22 or later and npm. After installation, dependencies and fonts are local. No API keys or external network access are needed for the app, tests, or pipeline.

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run pipeline:all
```

On Windows PowerShell with script execution disabled, use `npm.cmd`.

## Reproduce the committed checkpoint

The default seed is `20260927`. One timestamp is captured for all pipeline stages, rounded to ten minutes unless overridden. Set both explicitly to reproduce artifacts:

```powershell
$env:KAIROS_AS_OF = '2026-09-20T20:00:00Z'
$env:KAIROS_SEED = '20260927'
npm.cmd run pipeline:all
```

The pipeline writes intermediate data to `raw/` (gitignored), then schema-versioned JSON to `public/data/`, with identical bundled defaults in `src/data/fallback/`.

```text
Synthetic provider -> raw history -> walk-forward parameters and samples
                                      |               |
                                      v               v
                                  params.json     compact analogs
                                      |               |
                                      +---- backfill --+
                                      |
                                   snapshot -> forward ledger -> resolve
```

Individual stages: `pipeline:fetch`, `pipeline:params`, `pipeline:analogs`, `pipeline:backfill`, `pipeline:snapshot`, `pipeline:resolve`. Run in that order when regenerating from scratch. Resolve can run independently after a bell. Snapshots deduplicate by instrument, official-close anchor, and UTC hour.

## Research and audit rules

- The engine has no I/O, React, ambient clock, or unseeded randomness. Core domain types match `03-DATA-LAYER.md` section 2.
- Extended sessions take precedence through 20:00 New York, including half-days. The anchor remains the official 16:00 or 13:00 close. Friday evening reckoning therefore correctly shows zero drift until 20:00.
- Gap betas use trailing overnight gaps. Sector factors exclude the instrument itself and index anchors.
- Reversion fits use thin/moderate/deep buckets alongside the binding scalar parameter shape. Small samples pool within sectors and carry reduced evidence confidence.
- Historical forecasts use parameters estimated from data available at their anchor. Analogs must have resolved before that anchor. Synthetic token paths are simulations, **not actual historical rToken trades**.
- Compact analogs retain signed drift and quantize log returns to 0.1 basis point. Dictionaries, column names, and scale travel with the artifact.
- Forecasts log only during dark sessions above the 0.4% drift threshold. Corporate actions void fixes, which are excluded from all statistics.
- `computeStats` rejects mixed origins. Empty and zero-baseline-variance statistics have an explicit finite-zero convention. Negative skill is retained.

The numbered specifications remain the contract. Changes and limitations are in `NOTES-DECISIONS.md`; `NOTES-QWEN.md` confirms no model usage.

## Verification

Vitest covers calendar boundaries, DST, known-answer regressions, inverse-normal values, seeded scenarios, parameter estimation, attribution, liquidity, bands, analog sign alignment, calibration, and all specified data-quality guards. Pipeline acceptance checks cover schemas, finite values, index size, resolved fixes, fallback identity, deduplication, and corporate actions.

Browser smoke-checks use installed Edge over CDP with no added automation dependency. Captures are in `artifacts/screenshots/`.
