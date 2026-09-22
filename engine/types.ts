// ---------- Identity ----------

export type Symbol = string;              // "rNVDA"
export type Underlying = string;          // "NVDA"
export type SectorKey =
  | "semis" | "megacap_tech" | "crypto_beta"
  | "consumer_growth" | "financials" | "software";

export interface Instrument {
  symbol: Symbol;
  underlying: Underlying;
  name: string;                           // "NVIDIA Corporation"
  sector: SectorKey;
  anchorFactor: "rQQQ" | "rSPY";          // which index factor this name loads on
  weekend247: boolean;                    // is it in the 24/7 list
}

// ---------- Prices ----------

export interface Quote {
  symbol: Symbol;
  price: number;                          // last traded price, USDT
  bid: number | null;
  ask: number | null;
  ts: number;                             // epoch ms
  volume24h: number | null;               // quote volume in USDT
  /** Volume traded since the last official close. Null if unavailable. */
  volumeSinceClose: number | null;
}

export interface Candle {
  ts: number;                             // epoch ms, bar open time
  open: number; high: number; low: number; close: number;
  volume: number;
}

/** One official US exchange session for an underlying. */
export interface DailyBar {
  date: string;                           // "2026-09-19", New York calendar date
  open: number;                           // official open
  close: number;                          // official close
  high: number; low: number;
  volume: number;
  /** ln(open / prevClose) — the overnight gap. Null on the first bar. */
  gapLogReturn: number | null;
}

// ---------- Session ----------

export type SessionState =
  | "regular"        // 09:30–16:00 ET, real price discovery
  | "extended"       // 04:00–09:30 and 16:00–20:00 ET
  | "overnight"      // 20:00–04:00 ET on a weekday, exchange dark
  | "weekend"        // Fri 16:00 ET → Mon 04:00 ET, exchange dark
  | "holiday";       // full-day closure

export interface SessionInfo {
  state: SessionState;
  /** True when there is no live exchange price discovery. */
  isDark: boolean;
  /** Timestamp of the last official close that anchors the window. */
  anchorCloseTs: number;
  /** Timestamp of the next official open (the "sighting"). */
  nextOpenTs: number;
  /** 0..1 — how far through the dark window we are. */
  windowProgress: number;
  /** Total length of the current dark window, ms. */
  windowDurationMs: number;
}

// ---------- News ----------

export type NewsCategory =
  | "monetary_policy" | "macro_data" | "geopolitics" | "regulation"
  | "earnings" | "guidance" | "product" | "analyst" | "legal"
  | "supply_chain" | "crypto" | "other";

export interface NewsItem {
  id: string;
  ts: number;
  headline: string;
  source: string;
  url: string | null;
  /** Symbols this item plausibly affects. Empty means market-wide. */
  symbols: Symbol[];
  category: NewsCategory;
  /** LLM-assigned. Expected log-return impact on the named symbols. */
  impact: number | null;                  // e.g. 0.018 = +1.8%
  /** LLM-assigned confidence in the impact estimate, 0..1. */
  impactConfidence: number | null;
  /** True if this item's impact was already reflected before the anchor close. */
  preAnchor: boolean;
}

// ---------- Engine outputs (defined fully in 04-ENGINE.md) ----------

export interface InstrumentParams {
  symbol: Symbol;
  estimateStability: 'stable' | 'unstable';
  beta: number;                           // gap-beta to anchorFactor
  betaStdErr: number;
  gamma: number;                          // sector loading
  rSquared: number;
  /** Per-window idiosyncratic sigma of log returns, scaled to a full window. */
  sigmaIdio: number;
  /** Mean-reversion coefficient of drift at the bell. */
  kappa: number;
  kappaStdErr: number;
  /** Residual sigma of the gap forecast. */
  sigmaForecast: number;
  nObs: number;
  estimatedAt: number;
}

export interface Reckoning {
  symbol: Symbol;
  ts: number;
  anchorPrice: number;                    // last official close
  reckonedValue: number;                  // point estimate of fair value
  bandLow: number;                        // 80% interval
  bandHigh: number;
  tokenPrice: number;
  /** ln(tokenPrice / reckonedValue). Positive = token rich. */
  drift: number;
  /** 0..1. How much to trust that the move is information, not noise. */
  trust: number;
  trustLabel: "thin" | "moderate" | "deep";
  components: Attribution;
}

export interface Attribution {
  total: number;                          // ln(tokenPrice / anchorPrice)
  market: number;
  sector: number;
  news: number;
  unaccounted: number;
  /** News items that contributed, with their individual contributions. */
  newsDrivers: Array<{ id: string; headline: string; contribution: number }>;
}

export interface GapForecast {
  symbol: Symbol;
  ts: number;
  /** Forecast of ln(nextOpen / currentTokenPrice). Negative = token falls at the bell. */
  median: number;
  p10: number;
  p90: number;
  /** Probability the underlying opens below the current token price. */
  pTokenFalls: number;
  analogCount: number;
  /** Naive baseline forecast: always 0 (token price is already correct). */
  baseline: 0;
}

// ---------- The ledger ----------

export type FixOrigin = "live" | "backtest";
export type FixStatus = "open" | "closed" | "void";

export interface Fix {
  id: string;                             // deterministic: `${symbol}:${anchorCloseTs}:${ts}`
  origin: FixOrigin;
  status: FixStatus;
  symbol: Symbol;
  loggedAt: number;
  anchorCloseTs: number;
  targetOpenTs: number;
  modelVersion: string;                   // e.g. "1.2.0"
  inputsHash: string;                     // sha256 of the serialised inputs

  // What we said
  tokenPrice: number;
  reckonedValue: number;
  bandLow: number; bandHigh: number;
  drift: number;
  trust: number;
  forecast: GapForecast;
  call: "rich" | "cheap" | "fair";
  callConfidence: number;                 // 0..1

  // What happened (null until resolved)
  realisedOpen: number | null;
  realisedGap: number | null;             // ln(realisedOpen / tokenPrice)
  resolvedAt: number | null;
  directionalHit: boolean | null;
  inBand: boolean | null;                 // did realisedGap fall in [p10, p90]
  absError: number | null;                // |realisedGap - forecast.median|
  baselineAbsError: number | null;        // |realisedGap - 0|
  brier: number | null;
}
