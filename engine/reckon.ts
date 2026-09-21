import type { Attribution, Instrument, InstrumentParams, Quote, Reckoning, SessionInfo } from './types.js';
import type { LiquidityAssessment } from './liquidity.js';
import { getSessionInfo } from './calendar.js';
import { clamp, normInv } from './stats.js';
import { cleanQuote, guardBand, hasAnchor, staleParams } from './quality.js';
export interface ReckonInput {
  instrument:Instrument;params:InstrumentParams;anchorPrice:number;tokenPrice:number;
  marketFactorReturn:number;sectorFactorReturn:number;newsImpact:number;newsUncertainty:number;
  sessionEquivHours:number;standardWindowEquivHours:number;liquidity:LiquidityAssessment;ts:number;
  session?:SessionInfo; quote?:Quote; newsDrivers?:Attribution['newsDrivers'];
}
export function decompose(input:ReckonInput):Attribution {
  const total=Math.log(input.tokenPrice/input.anchorPrice), market=input.params.beta*input.marketFactorReturn;
  const sector=input.params.gamma*input.sectorFactorReturn, news=input.newsImpact;
  return {total,market,sector,news,unaccounted:total-market-sector-news,
    newsDrivers:[...(input.newsDrivers??[])].sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,5)};
}
export function reckon(input:ReckonInput):Reckoning {
  const {params,anchorPrice,tokenPrice,ts,liquidity}=input;
  if(!hasAnchor(anchorPrice)||!hasAnchor(tokenPrice)) throw new Error('Reckoning requires valid positive anchor and token prices');
  const base={symbol:input.instrument.symbol,ts,anchorPrice,tokenPrice,trust:liquidity.trust,trustLabel:liquidity.label,components:decompose(input)};
  if(!(input.session??getSessionInfo(ts)).isDark) {
    const q=input.quote?cleanQuote(input.quote):null;
    const low=q?.bid??tokenPrice*Math.exp(-.0002), high=q?.ask??tokenPrice*Math.exp(.0002);
    const band=guardBand(low,high,tokenPrice);
    return {...base,reckonedValue:tokenPrice,bandLow:band.low,bandHigh:band.high,drift:0};
  }
  if(!(input.standardWindowEquivHours>0)||input.sessionEquivHours<0) throw new Error('Invalid session-equivalent time');
  const fair=params.beta*input.marketFactorReturn+params.gamma*input.sectorFactorReturn+input.newsImpact;
  const reckonedValue=anchorPrice*Math.exp(fair);
  const variance=(params.betaStdErr*input.marketFactorReturn)**2+params.sigmaIdio**2*input.sessionEquivHours/input.standardWindowEquivHours+input.newsUncertainty**2+(.6*(1-liquidity.trust)*params.sigmaIdio)**2;
  const sigma=clamp(Math.sqrt(variance),.0015,.15)*(staleParams(params,ts)?1.2:1);
  const z=normInv(.9),band=guardBand(reckonedValue*Math.exp(-z*sigma),reckonedValue*Math.exp(z*sigma),reckonedValue);
  return {...base,reckonedValue,bandLow:band.low,bandHigh:band.high,drift:Math.log(tokenPrice/reckonedValue)};
}
