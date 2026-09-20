/** Deterministic statistical primitives. Inputs must be finite and non-empty. */
export function clamp(x: number, low = 0, high = 1): number { return Math.min(high, Math.max(low, x)); }
function check(xs: number[]): void {
  if (!xs.length || xs.some(x => !Number.isFinite(x))) throw new Error('Expected non-empty finite observations');
}
export function mean(xs: number[]): number { check(xs); return xs.reduce((a, b) => a + b, 0) / xs.length; }
export function stdev(xs: number[], ddof = 1): number {
  check(xs);
  if (ddof < 0 || xs.length <= ddof) throw new Error('Insufficient observations for standard deviation');
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - ddof));
}
export function quantile(sorted: number[], q: number): number {
  check(sorted);
  if (!(q >= 0 && q <= 1)) throw new Error('Quantile must be in [0, 1]');
  const pos = (sorted.length - 1) * q, i = Math.floor(pos);
  const a = sorted[i]!, b = sorted[Math.min(i + 1, sorted.length - 1)]!;
  return a + (b - a) * (pos - i);
}
export function median(xs: number[]): number { return quantile([...xs].sort((a, b) => a - b), 0.5); }
export interface OLSResult {
  slope: number; intercept: number; slopeStdErr: number; interceptStdErr: number;
  rSquared: number; residualStdErr: number; n: number; residuals: number[];
}
export function ols(x: number[], y: number[]): OLSResult {
  if (x.length !== y.length || x.length < 3) throw new Error('OLS requires at least 3 paired observations');
  check(x); check(y);
  const n = x.length, mx = mean(x), my = mean(y);
  const sxx = x.reduce((s, v) => s + (v - mx) ** 2, 0);
  if (sxx <= Number.EPSILON ** 2) throw new Error('OLS predictor has zero variance');
  const slope = x.reduce((s, v, i) => s + (v - mx) * (y[i]! - my), 0) / sxx;
  const intercept = my - slope * mx;
  const residuals = y.map((v, i) => v - (intercept + slope * x[i]!));
  const sse = residuals.reduce((s, v) => s + v * v, 0);
  const syy = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const residualStdErr = Math.sqrt(sse / (n - 2));
  return { slope, intercept, slopeStdErr: residualStdErr / Math.sqrt(sxx),
    interceptStdErr: residualStdErr * Math.sqrt(1 / n + mx * mx / sxx),
    rSquared: syy === 0 ? 1 : clamp(1 - sse / syy), residualStdErr, n, residuals };
}
/** Normalized exponentially weighted population variance, newest sample last. */
export function ewmaStdev(xs: number[], lambda: number): number {
  check(xs);
  if (!(lambda > 0 && lambda < 1)) throw new Error('EWMA lambda must be in (0, 1)');
  const weights = xs.map((_, i) => (1 - lambda) * lambda ** (xs.length - i - 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const m = xs.reduce((s, x, i) => s + x * weights[i]!, 0) / sum;
  return Math.sqrt(xs.reduce((s, x, i) => s + weights[i]! * (x - m) ** 2, 0) / sum);
}
export function normCdf(z: number): number {
  if (Number.isNaN(z)) throw new Error('Normal CDF requires a number');
  if (!Number.isFinite(z)) return z < 0 ? 0 : 1;
  if (z === 0) return 0.5;
  const x = Math.abs(z), t = 1 / (1 + 0.2316419 * x);
  const tail = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * t *
    (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z < 0 ? tail : 1 - tail;
}
/** Peter Acklam rational approximation; absolute error < 1e-6 at test quantiles. */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error('Normal inverse probability must be in (0, 1)');
  const a = [-39.69683028665376,220.9460984245205,-275.9285104469687,138.3577518672690,-30.66479806614716,2.506628277459239];
  const b = [-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
  const c = [-0.007784894002430293,-0.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d = [0.007784695709041462,0.3224671290700398,2.445134137142996,3.754408661907416];
  const poly = (co: number[], x: number): number => co.reduce((s, v) => s * x + v, 0);
  if (p < 0.02425 || p > 1 - 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
    const v = poly(c, q) / (poly(d, q) * q + 1);
    return p < 0.5 ? v : -v;
  }
  const q = p - 0.5, r = q * q;
  return poly(a, r) * q / (poly(b, r) * r + 1);
}
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function gaussian(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(Number.MIN_VALUE, rng()))) * Math.cos(2 * Math.PI * rng());
}
export function hashString(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export async function sha256Hex(s: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
