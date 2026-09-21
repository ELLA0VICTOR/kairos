import type { DailyBar, Instrument, InstrumentParams, SectorKey } from './types.js';
import type { LiquidityAssessment } from './liquidity.js';
import { clamp, median, ols, stdev } from './stats.js';
export type TrustLabel = LiquidityAssessment['label'];
export interface ReversionObservation {symbol:string;sector:SectorKey;label:TrustLabel;drift:number;realisedGap:number;ts:number}
export interface ReversionFit {kappa:number;kappaStdErr:number;sigmaForecast:number;nObs:number;pooled:boolean}
export type ReversionBuckets = Record<TrustLabel,ReversionFit>;
export interface ParameterEstimates {instruments:Record<string,InstrumentParams>;buckets:Record<string,ReversionBuckets>}
export function estimateReversion(observations:ReversionObservation[],symbol:string,sector:SectorKey,label:TrustLabel):ReversionFit {
  const own=observations.filter(o=>o.symbol===symbol&&o.label===label),pooled=own.length<40;
  const rows=pooled?observations.filter(o=>o.sector===sector&&o.label===label):own;
  if(rows.length<3 || rows.every(r=>r.drift===rows[0]!.drift)) return {kappa:0,kappaStdErr:1,sigmaForecast:.03,nObs:rows.length,pooled};
  const fit=ols(rows.map(r=>r.drift),rows.map(r=>r.realisedGap));
  const kappa=clamp(-fit.slope,0,1);
  // Forecasts use -kappa*drift, not OLS's intercept + unconstrained slope.
  // Include bias and clipping error rather than reporting an unused fit's sigma.
  const predictionError=Math.sqrt(rows.reduce((sum,r)=>sum+(r.realisedGap+kappa*r.drift)**2,0)/(rows.length-1));
  return {kappa,kappaStdErr:fit.slopeStdErr,sigmaForecast:Math.max(.0015,predictionError),nObs:rows.length,pooled};
}
/** Select scalars for the current bucket; the binding InstrumentParams shape is unchanged. */
export function selectParams(params:InstrumentParams,buckets:ReversionBuckets|undefined,label:TrustLabel):InstrumentParams {
  if(!buckets)return params;
  const b=buckets[label];
  return {...params,kappa:b.kappa,kappaStdErr:b.kappaStdErr,sigmaForecast:b.sigmaForecast,nObs:Math.min(params.nObs,b.nObs)};
}
export function estimateParameters(universe:Instrument[],history:Record<string,DailyBar[]>,estimatedAt:number,observations:ReversionObservation[]=[]):ParameterEstimates {
  const gaps=new Map<string,Map<string,number>>();
  for(const i of universe) gaps.set(i.symbol,new Map((history[i.symbol]??[]).filter(b=>b.gapLogReturn!==null).map(b=>[b.date,b.gapLogReturn!])));
  const marketFits=new Map<string,ReturnType<typeof ols>>();
  const datesBySymbol=new Map<string,string[]>();
  for(const i of universe) {
    const own=gaps.get(i.symbol)!,anchor=gaps.get(i.anchorFactor)!;
    const dates=[...own.keys()].filter(d=>anchor.has(d)).sort().slice(-250); datesBySymbol.set(i.symbol,dates);
    marketFits.set(i.symbol,ols(dates.map(d=>anchor.get(d)!),dates.map(d=>own.get(d)!)));
  }
  const instruments:Record<string,InstrumentParams>={},buckets:Record<string,ReversionBuckets>={};
  for(const i of universe) {
    const dates=datesBySymbol.get(i.symbol)!,fit=marketFits.get(i.symbol)!;
    const residual=(symbol:string,date:string):number|undefined=>{
      const item=universe.find(v=>v.symbol===symbol)!,y=gaps.get(symbol)?.get(date),x=gaps.get(item.anchorFactor)?.get(date);
      return y===undefined||x===undefined?undefined:y-marketFits.get(symbol)!.slope*x;
    };
    // Index anchors do not become sector peers; JPM and PLTR remain single-member sectors.
    const peers=universe.filter(j=>j.symbol!==i.symbol&&j.sector===i.sector&&j.symbol!=='rSPY'&&j.symbol!=='rQQQ');
    const paired=dates.flatMap(date=>{
      const peerValues=peers.map(j=>residual(j.symbol,date)).filter((v):v is number=>v!==undefined);
      return peers.length&&!peerValues.length?[]:[{y:residual(i.symbol,date)!,x:peerValues.length?median(peerValues):0}];
    });
    const varies=paired.some(p=>p.x!==paired[0]?.x);
    const gamma=peers.length&&varies?ols(paired.map(p=>p.x),paired.map(p=>p.y)).slope:0;
    const u=paired.map(p=>p.y-gamma*p.x);
    const bucket={thin:estimateReversion(observations,i.symbol,i.sector,'thin'),moderate:estimateReversion(observations,i.symbol,i.sector,'moderate'),deep:estimateReversion(observations,i.symbol,i.sector,'deep')};
    buckets[i.symbol]=bucket;
    instruments[i.symbol]={symbol:i.symbol,beta:fit.slope,betaStdErr:fit.slopeStdErr,gamma,rSquared:fit.rSquared,sigmaIdio:Math.max(.0015,stdev(u)),kappa:bucket.moderate.kappa,kappaStdErr:bucket.moderate.kappaStdErr,sigmaForecast:bucket.moderate.sigmaForecast,nObs:dates.length,estimatedAt};
  }
  return {instruments,buckets};
}
