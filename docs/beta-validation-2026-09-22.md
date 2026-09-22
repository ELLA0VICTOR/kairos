# Real-history beta validation

Frozen sample: 250 sessions, 23 September 2025 through 21 September 2026.
Halves: 23 September–23 March and 24 March–21 September.
OLS includes an intercept and uses conventional residual standard errors.
No exclusions, winsorization or forced slopes.

[Full twenty-name ranking, standard errors, t-statistics and both halves](beta-validation-tables.md).

## One bounded investigation

No adjustment or session-alignment bug was identified in AAPL/MSFT. Corporate-action records list ordinary dividends, with no in-window split or special dividend identified. The underlying provider, Massive, documents split-adjusted, non-dividend-adjusted OHLC. Kairos takes open and previous close from the same series, not raw open versus an adjusted-close column. This is a price-gap model, not a total-return model.

Sources: [Apple actions](https://investor.apple.com/dividend-history/), [Microsoft actions](https://www.microsoft.com/en-us/Investor/dividends-and-stock-history), [Microsoft FY2026 filing](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm), [Massive adjustment convention](https://massive.com/knowledge-base/article/is-massives-stock-data-adjusted-for-splits-or-dividends).

Adding ordinary dividends to the open as a sensitivity check barely changes the outcome. AAPL full beta changes from 0.086961 to 0.087319; halves from 0.429758/-0.102616 to 0.431447/-0.102998. MSFT full beta changes from 0.383865 to 0.383565; halves from 0.721567/0.185049 to 0.725283/0.182502. These sensitivity values are not substituted into the estimator.

All 250 local close/open pairs for AAPL, MSFT and NFLX align with QQQ by session date and with the calendar's previous official close. The forty largest AAPL/MSFT gaps were inspected explicitly. January 20 correctly pairs with January 16 across MLK Day; November 26 precedes Thanksgiving. None of these forty sessions is a half-day or follows a half-day. Winter/summer openings correctly map to 14:30/13:30 UTC.

Fresh MCP raw-timestamp corroboration was attempted with bounded timeouts but failed upstream. This report establishes internal alignment, not independent venue verification of every upstream print. The deployed site and REST quotes remained reachable. Detailed pairs and dividend sensitivity are saved in `raw/bitget/beta-root-cause.json`; `scripts/diagnose-beta-history.ts` reproduces them.

NFLX also fails: full beta -0.068957 (t -0.534), halves +0.059234 (t 0.301) and -0.132153 (t -0.755). This is weak exposure in both halves, not evidence of a reliable negative beta.

## Decision

Stable requires 250 observations, full and both half-sample absolute t-statistics at least 2, matching nonzero signs, and half-sample slope magnitudes within a factor of two. The ranking is also reviewed for broad sector coherence; individual exceptions do not stop valid names. Self-factor SPY/QQQ are identities, not independent significance evidence.

Treat MSFT's insignificant second half as disqualifying. The same policy also flags META and PLTR. This yields **15 stable instruments including two identity anchors and five unstable instruments**, not eighteen passing instruments. All measured betas remain unchanged.

Unstable and stale parameters share one 20% widening of log-return sigma for both reckoning and gap intervals, never compounded. Medians and non-dark bid/ask collapse are unchanged. Flagged names are excluded from automatic hero selection and unsolicited research examples. Model 1.2.0 applies to new calculations; old fixes are untouched.

## Real-data path

`npm run pipeline:real` builds a coherent real-market bundle from captured underlying history and fresh Bitget quotes. It refuses stale official-close dates. Auto mode uses it for the board, instrument and Ask, and falls back as a whole on failure. The Record remains explicitly synthetic and its 60.9% coverage is unchanged.

Real reversion is **cold start**: kappa=0, sigmaForecast=0.03, bucket nObs=0, and no real analog index. Since-close volume and live news impacts are not yet wired to this bundle. Missing volume is treated conservatively and missing news receives an uncertainty floor. These are real-price research estimates, not calibrated real-market forecasts.

The initial real run loaded all 20 quotes during the extended session on 22 September, so zero active dark-window forecasts was correct. Push/redeployment and `VITE_DATA_SOURCE=auto` are required for production activation. Refresh underlying history with `audit:bitget`, then `pipeline:real` before the anchor changes. Automated real-history refresh, token-history reversion/analogs and a real forward ledger remain Phase 10 work. The existing synthetic scheduled pipeline is separate.
