import { expect, test } from 'vitest';
import { findAnalogs, type AnalogRecord, weightedQuantile } from '@engine/analogs';
import { forecastEvidence, forecastGap } from '@engine/forecast';
import { reckon } from '@engine/reckon';
import { input, knownParams } from './helpers';
const record=(drift:number,id='a'):AnalogRecord=>({id,symbol:'rNVDA',date:'2026-01-01',drift,absDrift:Math.abs(drift),explainedShare:.1,trust:.2,windowType:'weekend',sectorKey:'semis',windowProgress:.6,realisedVolRegime:1,newsCategory:null,realisedGap:-.5*drift});
test('negative query sign-aligns positive-drift neighbour outcomes',()=>{
  const result=findAnalogs(record(-.04),[record(.04),record(.04,'b')]);
  expect(result.medianRealised).toBe(.02);expect(result.medianGivebackShare).toBe(.5);expect(result.revertedShare).toBe(1);
  expect(result.neighbours.reduce((s,n)=>s+n.weight,0)).toBeCloseTo(1,12);
  expect(result.neighbours[0]!.record.realisedGap).toBe(-.02); // raw audit evidence remains unflipped.
});
test('known 50% giveback, zero-drift exclusion and deterministic nearest ordering',()=>{
  const rows=Array.from({length:40},(_,i)=>record((i%2?-1:1)*(.004+i*.001),`${i}`));
  const result=findAnalogs(record(.03),rows,20);expect(result.count).toBe(20);expect(result.medianGivebackShare).toBeCloseTo(.5,12);
  expect(findAnalogs(record(0),[record(0)]).medianGivebackShare).toBe(0);
});
test('weighted quantiles respect weights',()=>{
  expect(weightedQuantile([{value:0,weight:.5},{value:10,weight:.5}],.5)).toBe(5);
  expect(weightedQuantile([{value:0,weight:.95},{value:10,weight:.05}],.1)).toBe(0);
});
test('positive kappa gives opposite-sign model forecast and ordered intervals',()=>{
  for(const price of [95,105]) {
    const x=input({tokenPrice:price}),r=reckon(x),empty=findAnalogs(record(r.drift),[]);
    const f=forecastGap(r,knownParams,x.liquidity,empty);
    expect(f.median).toBeCloseTo(-.6*r.drift,12);expect(Math.sign(f.median)).toBe(-Math.sign(r.drift));
    expect(f.p10).toBeLessThan(f.median);expect(f.p90).toBeGreaterThan(f.median);
    expect(f.pTokenFalls>.5).toBe(f.median<0);
    expect(forecastEvidence(f,knownParams).label).toContain('Low evidence');
  }
});
test('thin bucket residual uncertainty produces wider forecast interval',()=>{
  const x=input(),r=reckon(x),a=findAnalogs(record(r.drift),[]);
  const deep=forecastGap(r,{...knownParams,sigmaForecast:.008},x.liquidity,a);
  const thin=forecastGap(r,{...knownParams,sigmaForecast:.03},{...x.liquidity,label:'thin'},a);
  expect(thin.p90-thin.p10).toBeGreaterThan(deep.p90-deep.p10);
});
test('analog blend obeys half-weight ceiling with sign alignment',()=>{
  const x=input({tokenPrice:96}),r=reckon(x),rows=Array.from({length:80},(_,i)=>record(.04,`${i}`));
  const a=findAnalogs({...record(r.drift),absDrift:Math.abs(r.drift)},rows);
  expect(forecastGap(r,knownParams,x.liquidity,a).median).toBeCloseTo(.5*(-.6*r.drift)+.5*.02,12);
});
