# Phase 9 release status

## Demo-readiness update, 22 September 2026

The final local compressed production preview scored **Markets 91 performance / 100 accessibility** and **Instrument 95 / 100** with Lighthouse mobile defaults. Markets LCP was 2.9 seconds, blocking time 210 ms; Instrument LCP 2.2 seconds, blocking time 190 ms. Both had layout shift approximately 0.001. These are **local synthetic-mode build results, not a new Vercel audit**. The Instrument report was saved successfully before Windows temporary-profile cleanup returned EPERM.

The user confirmed the production budget variable was empty. JavaScript converted that empty string to zero. Empty/unset now uses the unchanged 30,000-token default; explicit zero still disables calls. Reason-specific notices distinguish a disabled setting, malformed setting, oversized request and depleted allowance. No key or prompt is logged.

A real local OpenAI request streamed a validated response in 19.210 seconds (8,227 input + 844 output tokens, including 5,504 cached input tokens). A local Qwen request authenticated and executed six engine tools, but its final write-up reached the 45-second research deadline. The streamed fallback completed in 48.237 seconds including artifact loading and delivery; reported completed-call usage was 1,837 tokens. Any unreported usage from the interrupted call is not included. Qwen's full successful write-up is therefore not claimed.

Ask now occupies the available viewport, with a fixed composer and internal message scrolling. The welcome screen was inspected in Lighthouse's desktop and mobile screenshots; both show the examples and composer within the viewport. The audits scored 96 accessibility and identified an invalid label on a generic conversation div; that label was removed in the final build. All 117 tests in 23 files, the production build and the plain-Node API smoke check pass. The navigation wordmark dot was removed. The local .env remains ignored by Git.

The owner still needs to push/redeploy and add the Qwen secret to Vercel separately if enabling it there. Local .env is not uploaded. After deployment, production Lighthouse and live Ask need confirmation. Prior keyboard/viewport/DOM limitations below remain; a Lighthouse screenshot is not an interactive keyboard test.


## Latest pre-recording check, 22 September 2026

Production now returns live Bitget quotes for all 20 instruments. The deployed real bundle has official-close anchor 2026-09-21 and passed the same coherence guard used by the app. The current extended session correctly produces no opening-gap forecasts. This supersedes the older cached/synthetic API observation below.

Production Ask completed a streamed fallback response in 2.565 seconds over 74 chunks, with validated figure references. The language budget is paused; this run used zero model tokens. This is HTTP/output validation, not a browser DOM check.

The latest deployed Lighthouse results are **Markets: 62 performance / 100 accessibility**, **Instrument: 58 performance / 100 accessibility**. Performance still fails the required 90. All **116 tests in 23 files** and the production build pass for the new transparent status notices and conversational Ask interface. These UI changes remain local until the owner pushes and redeploys.

Keyboard navigation, the full viewport matrix, provider-transition DOM behavior and browser console checks remain unverified. Automatic approval review previously rejected the browser-automation launch; that restriction was not bypassed. No complete Phase 9 sign-off is claimed.

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

- Push and redeploy the latest UI changes. Production now serves live quotes with a coherent real bundle; the owner retains push/redeployment.
- Reach performance 90 on both deployed routes and measure again after deployment.
- Complete actual keyboard navigation and the 390/768/1280/1920 route matrix. Browser automation launch was previously denied by automatic approval review; no usable existing CDP session was available. Code inspection does not substitute for this pass.
- Confirm production banner transitions during a real provider failure and recovery; local source selection is implemented but production DOM behavior was not verified.
- Confirm zero console warnings/errors across all routes in the same browser pass.
- Record the demo video. A walkthrough exists, but no finished recording is claimed.

Phase 9 and the full definition of done are therefore **not complete**. No further beta investigation, tuning or unrelated feature work is part of this checkpoint.
