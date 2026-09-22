# Demonstrating Kairos

## What the app does

Kairos helps someone understand a tokenized US stock while the underlying stock exchange is closed. A token can keep moving even when its official reference price is frozen.

Kairos starts from the last official stock close, considers market and sector moves and available news, and estimates a fair-value band. The difference between the token's price and that estimate is **drift**. Liquidity helps assess how much trust to place in the move. The opening-gap forecast estimates what could happen when the stock exchange opens again. The Record shows how saved forecasts performed. Ask Kairos runs the same engine tools and explains their evidence.

It is research, not an order-placement app. The estimates can be wrong. Real quotes do not mean the forecast model has been calibrated on real trading history.

## Two honest ways to demonstrate it

**Live mode** shows current Bitget quotes. In Vercel, set `VITE_DATA_SOURCE=auto`, leave `VITE_DATA_BASE` blank, then redeploy. On Markets the status should read **Live Bitget data**. If it says **Synthetic data**, the current screen is using the demo fallback. The Record is still synthetic in either mode.

The real-data bundle must contain the latest completed official stock close. To refresh it locally:

```sh
npm run audit:bitget
npm run pipeline:real
```

Then commit/push the updated `public/data/real-market.json` and redeploy. If the history provider fails, the refresh will fail rather than invent prices. Auto mode does not currently refresh that history by itself.

**Synthetic demo mode** is the complete demonstration with scenarios, news, analogs and a populated Record. For a reproducible dark-window scene, open `/?at=2026-09-20T20:00:00Z`. This is a simulated replay, never a live scene. The replay query applies to the page carrying it; when navigating, append it to Instrument too if you want the same fixed scene. Server-side Ask researches its current saved/provider snapshot, not the replay timestamp, and displays its own snapshot time.

During regular and extended trading, zero drift and no opening-gap forecast are intentional. External price discovery is still active. A live dark-window demonstration should be recorded after **20:00 New York** and before **04:00 New York** on a normal weeknight, or during a weekend closure. In September, the weeknight window is **01:00–09:00 Lagos time** the following day. The last official-close bundle must already have been refreshed for that night.

## A short test and recording sequence

1. **Markets:** check the source status and timestamp. Show a price, its fair-value band and drift. Explain that drift is a model difference, not guaranteed profit.
2. **Instrument:** open rNVDA or rTSLA. Show the attribution, liquidity and opening-gap interval. During an open/extended session, explain the paused state instead of implying the forecast is broken.
3. **Ask:** ask “What is behind the move in rNVDA?” Watch the actual research steps and engine-backed figures. Then ask “What is the risk of holding it?” The composer shows the retained rNVDA context. Naming another instrument replaces that context. Stop cancels a running request; New conversation clears the local thread.
4. **Record:** show the synthetic label and actual coverage. Say that this ledger tests the simulation, not proven live-market performance. Do not claim the real cold-start model has that track record.
5. **Method:** show the assumptions and disclosed unstable estimates. Close with what is available and what is still experimental.

Ask remains a bounded research assistant. The interface retains a conversation on the page and carries instrument context forward; it does not send prior model claims back as facts or run orders in the background. When the language service is unavailable, deterministic answers still stream from the engine, with an explicit label.

## Before calling the recording production-ready

- Confirm all routes, the active data status and Ask's reported snapshot.
- Check Tab/Shift+Tab, Enter, Escape in the Method modal, and the charts' arrow-key controls.
- Check 390, 768, 1280 and 1920 pixel widths.
- Meet deployed Lighthouse performance 90 and accessibility 95 on Markets and Instrument.
- See `phase9-release-status.md` for checks still outstanding. A working video does not substitute for these checks.
