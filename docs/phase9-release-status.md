# Phase 9 release status

The site is deployed at https://kairos-x-nu.vercel.app/. All five routes returned HTTP 200 on 22 September 2026. This does not mean every release criterion passes.

## Deployed checks, 22 September 2026

| Route | Lighthouse performance (mobile) | Accessibility |
|---|---:|---:|
| Markets | 51 | 97 |
| Instrument / rNVDA | 66 | 100 |

Accessibility meets the requested threshold; performance does not. The Markets audit wrote a valid report but its browser temporary-profile cleanup returned EPERM. Scores above are from the saved report, not an assumed successful exit.

The patched local production build measured 64 performance / 100 accessibility on Markets. It fixes the contrast failures but still misses the performance target. This score is not presented as a deployed result. All 115 tests in 22 files, the production build, and the plain-Node API smoke check passed after the changes.

The deployed quotes API returned HTTP 200 with `source=cache`, `dataSource=synthetic`, and one requested quote. The Ask API returned HTTP 200 and a complete validated fallback note over 68 chunks in 2.892 seconds. It reported the language service paused for today, zero model completions and zero tokens. Live OpenAI and real-data production research are not claimed.

## Prepared locally

- Corrected a deployed configuration mix-up that sent artifact requests to `/synthetic/data/`. Known mode names in `VITE_DATA_BASE` now resolve to the normal asset root.
- Moved expansion of compact analogs into the market worker for Markets/Instrument and split the live-provider imports out of the initial bundle.
- Fixed reported secondary-text contrast failures and removed the entrance delay from the principal heading.
- Added a synthetic-data banner keyed to the displayed provider, and route-change keyboard focus handling.
- Updated README with local setup, architecture, both pipelines, deployment variables and real-mode limitations.
- The Method content, MIT license and scheduled synthetic workflow already exist. Two successful hosted workflow runs were verified previously (35642049377 and 35626158181).

## Outstanding acceptance

- Deploy the latest committed code, set `VITE_DATA_SOURCE=auto`, clear `VITE_DATA_BASE`, and redeploy. The current production deployment still reports synthetic quotes. No authenticated Vercel session was available to the assistant; the owner retains push/redeployment.
- Reach performance 90 on both deployed routes and measure again after deployment.
- Complete actual keyboard navigation and the 390/768/1280/1920 route matrix. Browser automation launch was previously denied by automatic approval review; no usable existing CDP session was available. Code inspection does not substitute for this pass.
- Confirm production banner transitions during a real provider failure and recovery; local source selection is implemented but production DOM behavior was not verified.
- Confirm zero console warnings/errors across all routes in the same browser pass.
- Record the demo video. A walkthrough exists, but no finished recording is claimed.

Phase 9 and the full definition of done are therefore **not complete**. No further beta investigation, tuning or unrelated feature work is part of this checkpoint.
