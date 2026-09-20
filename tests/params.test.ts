import { expect,test } from 'vitest';
import { estimateParameters, estimateReversion, selectParams, type ReversionObservation } from '@engine/params';
import type { DailyBar, Instrument } from '@engine/types';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { ANCHORS, UNIVERSE } from '@/data/providers/anchors';
import { instrument, knownParams, TS } from './helpers';
import { ols } from '@engine/stats';
import barsNvda from './fixtures/bars-nvda.json';
test('known gap beta, leave-one-out gamma and single-member zero loading',()=>{
  const universe:Instrument[]=[{...instrument,symbol:'rQQQ',sector:'megacap_tech'},instrument,{...instrument,symbol:'rAMD'}, {...instrument,symbol:'rPLTR',sector:'software'}];
  const history:Record<string,DailyBar[]>={};
  for(const i of universe)history[i.symbol]=Array.from({length:400},(_,d)=>{
    // In every pair, market x is constant and sector s changes sign: Cov(x,s)=0.
    const x=d%4<2?-.01:.01,s=d%2?-.002:.002;
    const y=i.symbol==='rQQQ'?x:i.symbol==='rNVDA'?1.7*x+.5*s:i.symbol==='rAMD'?1.2*x+s:1.4*x;
    return {date:`${d}`.padStart(4,'0'),open:100*Math.exp(y),close:100,high:105,low:95,volume:1000,gapLogReturn:y};
  });
  const result=estimateParameters(universe,history,TS);
  expect(result.instruments.rNVDA!.beta).toBeCloseTo(1.7,12);
  expect(result.instruments.rNVDA!.gamma).toBeCloseTo(.5,12);
  expect(result.instruments.rPLTR!.gamma).toBe(0);
  expect(result.instruments.rNVDA!.nObs).toBe(250);
});
test('liquidity-bucket kappa and sector pooling have known answers',()=>{
  const obs:ReversionObservation[]=Array.from({length:50},(_,i)=>({symbol:'rAMD',sector:'semis',label:'thin',drift:(i-25)*.001,realisedGap:-.8*(i-25)*.001,ts:TS-1000}));
  const fit=estimateReversion(obs,'rNVDA','semis','thin');
  expect(fit.kappa).toBeCloseTo(.8,12);expect(fit.pooled).toBe(true);expect(fit.nObs).toBe(50);
  const deep={...fit,kappa:.2};
  expect(selectParams(knownParams,{thin:fit,moderate:fit,deep},'deep').kappa).toBe(.2);
});
test('frozen 400 NVDA bars estimate the seeded gap beta from independent factor history',async()=>{
  const p=new SyntheticProvider(20260927,()=>TS),q=await p.getDailyBars('QQQ',400);
  const fit=ols(q.slice(-250).map(b=>b.gapLogReturn!),barsNvda.slice(-250).map(b=>b.gapLogReturn!));
  // Simulation explicitly sets gap-beta to 1.08 * 1.7 = 1.836; finite-sample tolerance .15.
  expect(fit.slope).toBeCloseTo(1.836,0);
  expect(Math.abs(fit.slope-1.836)).toBeLessThan(.15);
  const history=Object.fromEntries(await Promise.all(ANCHORS.map(async a=>[a.symbol,await p.getDailyBars(a.underlying,400)] as const)));
  const params=estimateParameters(UNIVERSE,history,TS).instruments;
  expect(params.rJPM!.gamma).toBe(0);expect(params.rPLTR!.gamma).toBe(0);
});
