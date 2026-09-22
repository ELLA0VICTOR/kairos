import type { InstrumentParams, Quote } from './types.js';
export const isStaleQuote = (quote: Quote, now: number): boolean => now - quote.ts > 15 * 60_000;
export const isAbsurdDrift = (drift: number): boolean => !Number.isFinite(drift) || Math.abs(drift) > .25;
export const hasAnchor = (price: number | null | undefined): price is number => typeof price === 'number' && Number.isFinite(price) && price > 0;
export const staleParams = (params: InstrumentParams, now: number): boolean => now - params.estimatedAt > 14 * 86400_000;
/** Stale and unstable share one 20% safeguard; do not compound the penalty. */
export const bandMultiplier = (params:InstrumentParams,now:number):number => staleParams(params,now)||params.estimateStability==='unstable'?1.2:1;
export const noVolumeMove = (quote: Quote, drift: number): boolean => quote.volumeSinceClose === 0 && Math.abs(drift) > 0;
export function cleanQuote(quote: Quote): Quote {
  if (quote.bid !== null && quote.ask !== null && quote.bid > quote.ask) return {...quote,bid:null,ask:null};
  return {...quote};
}
/** Pure recovery returns a diagnostic for the I/O boundary to log. */
export function guardBand(low: number, high: number, value: number, production = false): {low:number;high:number;diagnostic:string|null} {
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && low < high) return {low,high,diagnostic:null};
  if (!production) throw new Error('Band inversion: expected 0 < bandLow < bandHigh');
  if (!hasAnchor(value)) throw new Error('Cannot recover band around invalid value');
  return {low:value*Math.exp(-.0015),high:value*Math.exp(.0015),diagnostic:'Band inversion recovered; investigate engine inputs'};
}
