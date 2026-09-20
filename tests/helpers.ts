import type { Instrument, InstrumentParams, Quote } from '@engine/types';
import type { ReckonInput } from '@engine/reckon';
import { getSessionInfo, STANDARD_WINDOW_EQUIV_HOURS } from '@engine/calendar';
import { assessLiquidity } from '@engine/liquidity';
import params from './fixtures/params-known.json';
export const TS=Date.parse('2026-09-20T20:00:00Z');
export const instrument:Instrument={symbol:'rNVDA',underlying:'NVDA',name:'NVIDIA Corporation',sector:'semis',anchorFactor:'rQQQ',weekend247:true};
export const knownParams:InstrumentParams=params;
export const quote:Quote={symbol:'rNVDA',price:104,bid:103.98,ask:104.02,ts:TS,volume24h:200000,volumeSinceClose:200000};
export function input(overrides:Partial<ReckonInput>={}):ReckonInput {
  return {instrument,params:{...params},anchorPrice:100,tokenPrice:104,marketFactorReturn:.01,sectorFactorReturn:.002,newsImpact:0,newsUncertainty:0,sessionEquivHours:STANDARD_WINDOW_EQUIV_HOURS,standardWindowEquivHours:STANDARD_WINDOW_EQUIV_HOURS,liquidity:assessLiquidity(quote,100000,.01),ts:TS,session:getSessionInfo(TS),quote,...overrides};
}
