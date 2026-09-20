import type { AnalogFeatures, AnalogRecord, AnalogResult } from '@engine/analogs';
import { findAnalogs } from '@engine/analogs';
import type { ExpectedVolume, ParamsArtifact, RawHistory, SnapshotRow } from '@engine/artifacts';
import { explainedShare } from '@engine/attribute';
import { getSessionInfo, nyDate, sessionEquivalentHours, STANDARD_WINDOW_EQUIV_HOURS, HOUR } from '@engine/calendar';
import { assessLiquidity } from '@engine/liquidity';
import { aggregateNews } from '@engine/news';
import { selectParams, type ReversionObservation } from '@engine/params';
import { hasAnchor, isAbsurdDrift, isStaleQuote } from '@engine/quality';
import { reckon, type ReckonInput } from '@engine/reckon';
import { forecastEvidence, forecastGap } from '@engine/forecast';
import { median, stdev } from '@engine/stats';
import type { NewsItem, SessionInfo } from '@engine/types';
import type { SyntheticProvider } from '@/data/providers/synthetic';
import { isAnchor } from '@/data/providers/anchors';

export interface Sample {windowIndex:number;input:ReckonInput;row:SnapshotRow;features:AnalogFeatures;realisedOpen:number;realisedGap:number;targetOpenTs:number}
export const windowType=(session:SessionInfo):AnalogFeatures['windowType']=>session.state==='holiday'?'holiday':session.windowDurationMs>30*HOUR?'weekend':'overnight';
export function expectedVolume(entries:ExpectedVolume[],symbol:string,session:SessionInfo,ts:number,fallback:number):number {
  const bucket=Math.floor((ts-session.anchorCloseTs)/HOUR),type=windowType(session);
  const candidates=entries.filter(e=>e.symbol===symbol&&e.windowType===type).sort((a,b)=>Math.abs(a.hourBucket-bucket)-Math.abs(b.hourBucket-bucket));
  return Math.max(1,candidates[0]?.median??fallback);
}
export function volumeTable(samples:Sample[]):ExpectedVolume[] {
  const groups=new Map<string,{symbol:string;windowType:AnalogFeatures['windowType'];hourBucket:number;volumes:number[]}>();
  for(const sample of samples) {
    const symbol=sample.row.instrument.symbol,type=sample.features.windowType,bucket=Math.floor((sample.input.ts-sample.input.session!.anchorCloseTs)/HOUR);
    const key=`${symbol}:${type}:${bucket}`,group=groups.get(key)??{symbol,windowType:type,hourBucket:bucket,volumes:[]};
    group.volumes.push(sample.row.quote.volumeSinceClose??0);groups.set(key,group);
  }
  return [...groups.values()].map(({volumes,...key})=>({...key,median:Math.max(1,median(volumes)),nObs:volumes.length}));
}
export function reversionObservations(samples:Sample[],beforeTs:number):ReversionObservation[] {
  return samples.filter(s=>s.targetOpenTs<=beforeTs&&s.input.session!.isDark).map(s=>({symbol:s.row.instrument.symbol,sector:s.row.instrument.sector,label:s.row.liquidity.label,drift:s.row.reckoning.drift,realisedGap:s.realisedGap,ts:s.targetOpenTs}));
}
export function analogRecord(sample:Sample):AnalogRecord {
  const anchor=sample.input.session!.anchorCloseTs;
  return {...sample.features,id:`${sample.row.instrument.symbol}:${anchor}:${Math.round(sample.features.windowProgress*100)}`,symbol:sample.row.instrument.symbol,date:nyDate(anchor),realisedGap:sample.realisedGap};
}
export function volatilityRegime(history:RawHistory,symbol:string,anchorTs:number):number {
  const anchorDate=nyDate(anchorTs);
  const bars=(history.bars[symbol]??[]).filter(b=>b.date<=anchorDate&&b.gapLogReturn!==null).slice(-270);
  const xs=bars.map(b=>b.gapLogReturn!);if(xs.length<40)return 1;
  const windows:number[]=[];for(let i=20;i<=xs.length;i++)windows.push(stdev(xs.slice(i-20,i)));
  return stdev(xs.slice(-20))/Math.max(.00001,median(windows));
}
export async function researchAt(provider:SyntheticProvider,history:RawHistory,params:ParamsArtifact,ts:number,index:AnalogRecord[]=[],withForecast=true):Promise<{samples:Sample[];news:NewsItem[];session:SessionInfo}> {
  const session=getSessionInfo(ts),quotes=(await provider.getQuotes(history.universe.map(i=>i.symbol),ts)).quotes;
  const quoteMap=new Map(quotes.map(q=>[q.symbol,q]));
  const anchors=Object.fromEntries(history.universe.map(i=>[i.symbol,provider.anchorPrice(i.symbol,session.anchorCloseTs)]));
  const returns=Object.fromEntries(quotes.map(q=>[q.symbol,Math.log(q.price/anchors[q.symbol]!)]));
  const news=await provider.getNews(session.anchorCloseTs,undefined,ts),samples:Sample[]=[];
  const equiv=sessionEquivalentHours(session.anchorCloseTs,ts);
  for(const instrument of history.universe) {
    const quote=quoteMap.get(instrument.symbol),anchorPrice=anchors[instrument.symbol],base=params.instruments[instrument.symbol];
    if(!quote||!hasAnchor(anchorPrice)||!base)continue;
    const peers=history.universe.filter(i=>i.sector===instrument.sector&&i.symbol!==instrument.symbol&&!isAnchor(i.symbol));
    const residuals=peers.map(i=>returns[i.symbol]!-params.instruments[i.symbol]!.beta*returns[i.anchorFactor]!);
    const sectorFactorReturn=peers.length&&!isAnchor(instrument.symbol)?median(residuals):0;
    const impact=aggregateNews(news,instrument.symbol,session.anchorCloseTs,ts);
    // Cold start uses unconditioned synthetic notional, never the current scenario's reduced volume.
    const path=provider.windowPath(instrument.symbol,session);
    const fallback=path[Math.min(path.length-1,Math.floor((ts-session.anchorCloseTs)/300000))]!.expectedCumulativeVolume;
    const liquidity=assessLiquidity(quote,expectedVolume(params.expectedVolumes,instrument.symbol,session,ts,fallback),Math.abs(returns[instrument.symbol]!));
    const selected=selectParams(base,params.buckets[instrument.symbol],liquidity.label);
    const input:ReckonInput={instrument,params:selected,anchorPrice,tokenPrice:quote.price,marketFactorReturn:returns[instrument.anchorFactor]!,sectorFactorReturn,newsImpact:impact.impact,newsUncertainty:impact.uncertainty,sessionEquivHours:equiv,standardWindowEquivHours:STANDARD_WINDOW_EQUIV_HOURS,liquidity,ts,session,quote,newsDrivers:impact.drivers};
    const reckoning=reckon(input);
    const features:AnalogFeatures={absDrift:Math.abs(reckoning.drift),drift:reckoning.drift,explainedShare:explainedShare(reckoning.components),trust:reckoning.trust,windowType:windowType(session),sectorKey:instrument.sector,windowProgress:session.windowProgress,realisedVolRegime:volatilityRegime(history,instrument.symbol,session.anchorCloseTs),newsCategory:news.find(n=>n.impact&&n.symbols.includes(instrument.symbol))?.category??null};
    let analogs:AnalogResult|undefined;
    const eligible=withForecast&&session.isDark&&!isStaleQuote(quote,ts)&&!isAbsurdDrift(reckoning.drift);
    if(eligible)analogs=findAnalogs(features,index);
    const forecast=analogs?forecastGap(reckoning,selected,liquidity,analogs):null;
    const row:SnapshotRow={instrument,quote,reckoning,forecast,liquidity,evidence:forecast?forecastEvidence(forecast,selected).label:null,stale:isStaleQuote(quote,ts)};
    const realisedOpen=session.nextOpenTs<=history.windows.at(-1)!.targetOpenTs?provider.officialOpen(instrument.underlying,session.nextOpenTs):0;
    samples.push({windowIndex:-1,input,row,features,realisedOpen,realisedGap:realisedOpen?Math.log(realisedOpen/quote.price):0,targetOpenTs:session.nextOpenTs});
  }
  return {samples,news,session};
}
