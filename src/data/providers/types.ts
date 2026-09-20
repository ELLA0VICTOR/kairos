// src/data/providers/types.ts
import type { Quote, Candle, DailyBar, NewsItem, Instrument, Symbol } from "@engine/types";

export type ProviderId = "synthetic" | "bitget" | "cache";

export interface ProviderHealth {
  id: ProviderId;
  ok: boolean;
  lastSuccessTs: number | null;
  lastErrorTs: number | null;
  lastError: string | null;
}

export interface MarketDataProvider {
  readonly id: ProviderId;

  /** True if this provider is currently usable. Cheap; may use cached health. */
  isAvailable(): Promise<boolean>;

  health(): ProviderHealth;

  /** The tradable universe. */
  getUniverse(): Promise<Instrument[]>;

  /** Current 24/7 quotes. Must return one entry per requested symbol or omit it. */
  getQuotes(symbols: Symbol[]): Promise<{ asOf: number; quotes: Quote[] }>;

  /** Intraday candles for the current dark window. */
  getWindowCandles(
    symbol: Symbol,
    fromTs: number,
    intervalMinutes: 5 | 15 | 60
  ): Promise<Candle[]>;

  /** Official daily bars for the UNDERLYING equity, used for parameter estimation. */
  getDailyBars(underlying: string, days: number): Promise<DailyBar[]>;

  /** News since a timestamp, optionally filtered to symbols. */
  getNews(sinceTs: number, symbols?: Symbol[]): Promise<NewsItem[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    public readonly method: string,
    message: string,
    public override readonly cause?: unknown
  ) { super(message); this.name = "ProviderError"; }
}
