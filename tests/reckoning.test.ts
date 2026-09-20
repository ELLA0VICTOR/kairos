import { expect, test } from 'vitest';
import { reckon } from '@engine/reckon';
import { attribute, attributionSentence, explainedShare } from '@engine/attribute';
import { assessLiquidity } from '@engine/liquidity';
import { aggregateNews } from '@engine/news';
import { mulberry32, normInv } from '@engine/stats';
import { atNy, getSessionInfo } from '@engine/calendar';
import { cleanQuote, guardBand, hasAnchor, isAbsurdDrift, isStaleQuote, noVolumeMove, staleParams } from '@engine/quality';
import { input, knownParams, quote, TS } from './helpers';
import weekend from './fixtures/window-weekend.json';
import type { NewsItem } from '@engine/types';

test('reckoning known answer and band contains the point',()=>{
  // fair return = 1.5*.01 + .5*.002 = .016; trust=1, variance=.001^2+.01^2.
  const r=reckon(input());
  expect(r.reckonedValue).toBeCloseTo(100*Math.exp(.016),12);
  expect(r.bandLow).toBeCloseTo(100*Math.exp(.016-normInv(.9)*Math.sqrt(.000101)),12);
  expect(r.drift).toBeCloseTo(Math.log(1.04)-.016,12);
  expect(r.bandLow).toBeLessThan(r.reckonedValue);expect(r.bandHigh).toBeGreaterThan(r.reckonedValue);
});
test('band widens with time and falling trust',()=>{
  const base=input(), r=reckon(base);
  expect(reckon({...base,sessionEquivHours:base.sessionEquivHours*2}).bandHigh).toBeGreaterThan(r.bandHigh);
  expect(reckon({...base,liquidity:{...base.liquidity,trust:0,label:'thin'}}).bandHigh).toBeGreaterThan(r.bandHigh);
});
test('regular and Friday extended sessions collapse reckoning to observed bid/ask',()=>{
  for(const ts of [atNy('2026-09-22','12:00'),atNy('2026-09-18','17:00'),atNy('2026-11-27','15:00')]) {
    const r=reckon(input({ts,session:getSessionInfo(ts)}));
    expect(r.drift).toBe(0);expect(r.reckonedValue).toBe(quote.price);
    expect(r.bandLow).toBe(quote.bid);expect(r.bandHigh).toBe(quote.ask);
  }
});
test('attribution adds to total within 1e-12 for 100 seeded inputs',()=>{
  const rng=mulberry32(731);
  for(let i=0;i<100;i++) {
    const x=input({tokenPrice:90+20*rng(),marketFactorReturn:(rng()-.5)*.1,sectorFactorReturn:(rng()-.5)*.02,newsImpact:(rng()-.5)*.02});
    const a=attribute(x,reckon(x));
    expect(Math.abs(a.market+a.sector+a.news+a.unaccounted-a.total)).toBeLessThan(1e-12);
  }
});
test('frozen liquidity ghost is mostly unexplained and thin; news repricing is explained and deep',()=>{
  for(const [symbol,beta] of [['rTSLA',1.9],['rNVDA',1.7]] as const) {
    const p=weekend.paths[symbol].at(-1)!,q=weekend.quotes.quotes.find(q=>q.symbol===symbol)!;
    const fair=beta*p.market+.65*p.sector+p.news;
    const anchor=p.price/Math.exp(fair+p.idio),total=Math.log(q.price/anchor);
    const liquidity=assessLiquidity(q,500000,total);
    const x=input({instrument:{...input().instrument,symbol},params:{...knownParams,beta,gamma:.65},anchorPrice:anchor,tokenPrice:q.price,marketFactorReturn:p.market,sectorFactorReturn:p.sector,newsImpact:p.news,liquidity});
    const r=reckon(x),share=explainedShare(r.components);
    if(symbol==='rTSLA'){expect(share).toBeLessThan(.2);expect(r.trustLabel).toBe('thin');}
    else {expect(share).toBeGreaterThan(.75);expect(r.trustLabel).toBe('deep');}
  }
});
test('trust separates large low-volume moves from proportional deep moves',()=>{
  const thin=assessLiquidity({...quote,bid:103.8,ask:104.2,volumeSinceClose:10000},100000,.05);
  expect(thin.label).toBe('thin');expect(thin.reasons.join(' ')).toContain('unusual');
  expect(assessLiquidity(quote,100000,.01).trust).toBe(1);
});
test('quality guards: stale quote, absurd drift, crossed book, zero volume, missing anchor',()=>{
  expect(isStaleQuote(quote,TS+15*60000)).toBe(false);expect(isStaleQuote(quote,TS+15*60000+1)).toBe(true);
  expect(isAbsurdDrift(.251)).toBe(true);expect(isAbsurdDrift(.25)).toBe(false);
  expect(cleanQuote({...quote,bid:106,ask:105})).toMatchObject({bid:null,ask:null});
  const zero={...quote,volumeSinceClose:0};expect(noVolumeMove(zero,.01)).toBe(true);expect(assessLiquidity(zero,100000,.01).trust).toBe(0);
  expect(hasAnchor(null)).toBe(false);expect(hasAnchor(0)).toBe(false);expect(hasAnchor(100)).toBe(true);
  expect(()=>reckon(input({anchorPrice:0}))).toThrow('anchor');
});
test('stale parameters widen log bands by exactly 20%',()=>{
  const x=input(),fresh=reckon(x),old=reckon({...x,params:{...x.params,estimatedAt:TS-15*86400_000}});
  expect(staleParams({...knownParams,estimatedAt:TS-15*86400_000},TS)).toBe(true);
  expect(Math.log(old.bandHigh/old.reckonedValue)/Math.log(fresh.bandHigh/fresh.reckonedValue)).toBeCloseTo(1.2,12);
});
test('band inversion throws in development and returns a recovery diagnostic in production',()=>{
  expect(()=>guardBand(101,100,100)).toThrow('Band inversion');
  const recovered=guardBand(101,100,100,true);expect(recovered.low).toBeLessThan(recovered.high);expect(recovered.diagnostic).toContain('recovered');
});
test('news excludes pre-anchor and future stories, dampens duplicates and preserves null distinction',()=>{
  const item:NewsItem={id:'n',ts:TS-1000,headline:'Simulated',source:'Kairos simulated wire',url:null,symbols:['rNVDA'],category:'guidance',impact:.035,impactConfidence:.8,preAnchor:false};
  const result=aggregateNews([item,{...item,id:'old',preAnchor:true},{...item,id:'future',ts:TS+1}],'rNVDA',TS-2000,TS);
  expect(result.impact).toBeCloseTo(.1*Math.tanh(.35),12);expect(result.drivers).toHaveLength(1);expect(result.uncertainty).toBeGreaterThanOrEqual(.002);
});
test('copy handles opposing explanation and volume-backed unknown moves',()=>{
  const a={...reckon(input()).components,total:.01,unaccounted:.02};
  expect(explainedShare(a)).toBe(0);
  expect(attributionSentence(a,.9)).toContain('real volume');expect(attributionSentence(a,.1)).toContain('thin');
});
