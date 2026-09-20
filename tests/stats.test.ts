import { expect, test } from 'vitest';
import { ewmaStdev, gaussian, hashString, mean, median, mulberry32, normCdf, normInv, ols, quantile, sha256Hex, stdev } from '@engine/stats';
test('five-point OLS known answer with two-pass centered sums', () => {
  // x mean=3, y mean=4; Sxx=10, Sxy=8, Syy=8; slope=.8, intercept=1.6.
  // Residuals [-.4,.8,0,-.8,.4]; SSE=1.6; R2=.8; variance=1.6/3.
  const fit = ols([1,2,3,4,5],[2,4,4,4,6]);
  expect(fit.slope).toBeCloseTo(.8,12); expect(fit.intercept).toBeCloseTo(1.6,12);
  expect(fit.rSquared).toBeCloseTo(.8,12);
  expect(fit.residualStdErr).toBeCloseTo(Math.sqrt(1.6/3),12);
  expect(fit.slopeStdErr).toBeCloseTo(Math.sqrt(1.6/30),12);
  expect(fit.interceptStdErr).toBeCloseTo(Math.sqrt(1.6/3*(.2+.9)),12);
});
test('OLS rejects insufficient observations and constant predictors', () => {
  expect(() => ols([1,2],[1,2])).toThrow('at least 3');
  expect(() => ols([1,1,1],[2,3,4])).toThrow('zero variance');
  expect(ols([1e9+1,1e9+2,1e9+3],[4,6,8]).slope).toBe(2);
});
test.each([[.025,-1.959963984540054],[.1,-1.2815515655446],[.5,0],[.9,1.2815515655446],[.975,1.959963984540054]])('normal inverse at %s', (p,z) => {
  expect(Math.abs(normInv(p)-z)).toBeLessThan(1e-6);
  expect(normCdf(z)).toBeCloseTo(p,6);
});
test('summary primitives have hand-computed answers', () => {
  expect(mean([1,2,3,4])).toBe(2.5); expect(stdev([1,2,3])).toBe(1);
  expect(median([4,1,3,2])).toBe(2.5); expect(quantile([0,10],.1)).toBe(1);
  // normalized EW weights for [0,2] at lambda=.5 are 1/3,2/3; variance=8/9.
  expect(ewmaStdev([0,2],.5)).toBeCloseTo(Math.sqrt(8/9),12);
});
test('seeded randomness repeats; Gaussian moments are plausible', () => {
  const a=mulberry32(123),b=mulberry32(123);
  expect(Array.from({length:20},a)).toEqual(Array.from({length:20},b));
  const rng=mulberry32(42), draws=Array.from({length:10000},()=>gaussian(rng));
  expect(Math.abs(mean(draws))).toBeLessThan(.03); expect(stdev(draws)).toBeCloseTo(1,1);
  expect(hashString('hello')).toBe(1335831723);
});
test('SHA256 published abc vector',async()=>{
  expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
