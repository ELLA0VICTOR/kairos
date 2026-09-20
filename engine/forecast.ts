import type { GapForecast, InstrumentParams, Reckoning } from './types';
import type { LiquidityAssessment } from './liquidity';
import { alignedGap, type AnalogResult } from './analogs';
import { clamp, normCdf, normInv } from './stats';
import { isAbsurdDrift } from './quality';
export function forecastGap(reckoning:Reckoning,params:InstrumentParams,_liquidity:LiquidityAssessment,analogs:AnalogResult):GapForecast {
  if(isAbsurdDrift(reckoning.drift))throw new Error('Drift outside model range');
  const modelMedian=-params.kappa*reckoning.drift,modelSigma=Math.max(.0015,params.sigmaForecast);
  const w=clamp(analogs.count/60,0,.5);
  const values=analogs.neighbours.map(n=>({gap:alignedGap(n.record,reckoning.drift),weight:n.weight}));
  const m=values.reduce((s,v)=>s+v.gap*v.weight,0);
  const analogSigma=Math.sqrt(values.reduce((s,v)=>s+v.weight*(v.gap-m)**2,0));
  const median=(1-w)*modelMedian+w*analogs.medianRealised;
  const sigma=Math.max(.0015,Math.sqrt((1-w)**2*modelSigma**2+w*w*analogSigma**2));
  return {symbol:reckoning.symbol,ts:reckoning.ts,median,p10:median-normInv(.9)*sigma,p90:median+normInv(.9)*sigma,pTokenFalls:normCdf(-median/sigma),analogCount:analogs.count,baseline:0};
}
export function forecastEvidence(forecast:GapForecast,params:InstrumentParams):{label:string|null;confidenceMultiplier:number} {
  const low=forecast.analogCount<10||params.nObs<40;
  return {label:low?`Low evidence — ${forecast.analogCount} analogs, ${params.nObs} observations`:null,confidenceMultiplier:low?.5:1};
}
