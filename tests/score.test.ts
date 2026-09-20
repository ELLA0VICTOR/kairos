import { expect, test } from 'vitest';
import { buildFix, canonicalJson, computeStats, resolveFix, shouldLogFix, voidForAction } from '@engine/score';
import { forecastGap } from '@engine/forecast';
import { findAnalogs } from '@engine/analogs';
import { reckon } from '@engine/reckon';
import { gaussian, mulberry32 } from '@engine/stats';
import { input, knownParams, TS } from './helpers';
import type { Fix } from '@engine/types';
export async function fixtureFix():Promise<Fix> {
  const x=input(),r=reckon(x);
  const a=findAnalogs({absDrift:Math.abs(r.drift),drift:r.drift,explainedShare:0,trust:.2,windowType:'weekend',sectorKey:'semis',windowProgress:.5,realisedVolRegime:1,newsCategory:null},[]);
  return buildFix({reckoning:r,forecast:forecastGap(r,knownParams,x.liquidity,a),session:x.session!,modelVersion:'1.0.0',origin:'backtest',loggedAt:TS});
}
test('fix hashes are deterministic and object insertion-order independent',async()=>{
  expect(await fixtureFix()).toEqual(await fixtureFix());expect(canonicalJson({a:1,b:2})).toBe(canonicalJson({b:2,a:1}));
  expect((await fixtureFix()).inputsHash).toMatch(/^[a-f0-9]{64}$/);
});
test('baseline-identical forecasts have exactly zero skill',async()=>{
  const f=await fixtureFix();f.forecast={...f.forecast,median:0};
  const rows=[-.02,.01,.03].map(g=>resolveFix(f,f.tokenPrice*Math.exp(g),f.targetOpenTs));
  expect(computeStats(rows).skillScore).toBe(0);
});
test('1000 forecast-distributed outcomes achieve 80% coverage within four points',async()=>{
  const f=await fixtureFix(),rng=mulberry32(9127),rows:Fix[]=[];
  for(let i=0;i<1000;i++)rows.push(resolveFix({...f,id:`fix-${i}`},f.tokenPrice*Math.exp(f.forecast.median+knownParams.sigmaForecast*gaussian(rng)),f.targetOpenTs));
  const stats=computeStats(rows);console.log(`Band coverage: ${stats.bandCoverage.toFixed(3)} (1000 seeded outcomes; target 0.80 +/- 0.04)`);
  expect(stats.bandCoverage).toBeGreaterThanOrEqual(.76);expect(stats.bandCoverage).toBeLessThanOrEqual(.84);
});
test('voids excluded from all stats, including nOpen and cuts',async()=>{
  const f=await fixtureFix(),closed=resolveFix(f,f.tokenPrice*.98,f.targetOpenTs);
  const voided=voidForAction({...f,id:'void'},[{symbol:f.symbol,effectiveTs:f.targetOpenTs,kind:'split'}],f.targetOpenTs);
  expect(voided.status).toBe('void');
  expect(computeStats([closed,voided],{rNVDA:'semis'})).toEqual(computeStats([closed],{rNVDA:'semis'}));
});
test('resolution known error, Brier, negative skill and no premature resolution',async()=>{
  const f=await fixtureFix();f.forecast={...f.forecast,median:-.02,p10:-.04,p90:0,pTokenFalls:.8};
  const r=resolveFix(f,f.tokenPrice*Math.exp(.01),f.targetOpenTs);
  expect(r.absError).toBeCloseTo(.03,12);expect(r.baselineAbsError).toBeCloseTo(.01,12);expect(r.brier).toBeCloseTo(.64,12);
  expect(r.directionalHit).toBe(false);expect(r.inBand).toBe(false);expect(computeStats([r]).skillScore).toBeCloseTo(-8,10);
  expect(()=>resolveFix(f,100,f.targetOpenTs-1)).toThrow('before');
});
test('stats reject mixed origins; empty statistics are finite',async()=>{
  const f=await fixtureFix();expect(()=>computeStats([f,{...f,origin:'live'}])).toThrow('never be pooled');
  expect(JSON.stringify(computeStats([]))).not.toContain('null');
});
test('mechanical threshold and once-per-hour logging',async()=>{
  const f=await fixtureFix(),x=input(),r=reckon(x);
  expect(shouldLogFix(r,x.session!,[],TS)).toBe(true);
  expect(shouldLogFix(r,x.session!,[f],TS+1)).toBe(false);
  expect(shouldLogFix({...r,drift:.004},x.session!,[],TS)).toBe(false);
});
