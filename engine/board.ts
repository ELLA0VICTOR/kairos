import type { ArtifactSet, SnapshotRow } from './artifacts.js';
import type { Candle, NewsItem, Quote, Reckoning, SessionInfo } from './types.js';
import { getSessionInfo, HOUR, sessionEquivalentHours, STANDARD_WINDOW_EQUIV_HOURS } from './calendar.js';
import { analogScales, findAnalogs, type AnalogFeatures, type AnalogResult } from './analogs.js';
import { aggregateNews } from './news.js';
import { assessLiquidity } from './liquidity.js';
import { selectParams } from './params.js';
import { reckon } from './reckon.js';
import { median } from './stats.js';
import { explainedShare } from './attribute.js';
import { forecastEvidence, forecastGap } from './forecast.js';
import { hasAnchor, isAbsurdDrift, isStaleQuote } from './quality.js';
export interface MarketFrame {ts:number;quotes:Quote[];anchors:Record<string,number>;news:NewsItem[];candles:Record<string,Candle[]>}
export interface BoardRow extends SnapshotRow {analogs:AnalogResult;features:AnalogFeatures;path:number[]}
export interface Board {ts:number;session:SessionInfo;news:NewsItem[];rows:BoardRow[];frame:MarketFrame}
export function computeBoard(data:ArtifactSet,frame:MarketFrame,withAnalogs=true):Board {
  const {ts,quotes,anchors,news}=frame,session=getSessionInfo(ts);
  const elapsedEquiv=sessionEquivalentHours(session.anchorCloseTs,ts);
  const qMap=new Map(quotes.map(q=>[q.symbol,q]));
  const returns=Object.fromEntries(quotes.filter(q=>hasAnchor(anchors[q.symbol])).map(q=>[q.symbol,Math.log(q.price/anchors[q.symbol]!)]));
  const scales=withAnalogs?analogScales(data.analogs):[];
  const rows:BoardRow[]=[];
  for(const instrument of data.universe){
    const symbol=instrument.symbol,q=qMap.get(symbol),anchorPrice=anchors[symbol],p=data.params.instruments[symbol];
    if(!q||!hasAnchor(anchorPrice)||!p||returns[instrument.anchorFactor]===undefined)continue;
    const peers=data.universe.filter(i=>i.symbol!==symbol&&i.symbol!=='rSPY'&&i.symbol!=='rQQQ'&&i.sector===instrument.sector&&returns[i.symbol]!==undefined);
    const residuals=peers.map(i=>returns[i.symbol]!-data.params.instruments[i.symbol]!.beta*returns[i.anchorFactor]!);
    const sector=peers.length&&symbol!=='rSPY'&&symbol!=='rQQQ'?median(residuals):0;
    const impact=aggregateNews(news,symbol,session.anchorCloseTs,ts);
    const type=session.state==='holiday'?'holiday':session.windowDurationMs>30*HOUR?'weekend':'overnight';
    const bucket=Math.floor((ts-session.anchorCloseTs)/HOUR);
    const volumes=data.params.expectedVolumes.filter(e=>e.symbol===symbol&&e.windowType===type).sort((a,b)=>Math.abs(a.hourBucket-bucket)-Math.abs(b.hourBucket-bucket));
    const liquidity=assessLiquidity(q,volumes[0]?.median??Math.max(1,q.volumeSinceClose??1),returns[symbol]!);
    const selected=selectParams(p,data.params.buckets[symbol],liquidity.label);
    const r=reckon({instrument,params:selected,anchorPrice,tokenPrice:q.price,marketFactorReturn:returns[instrument.anchorFactor]!,sectorFactorReturn:sector,newsImpact:impact.impact,newsUncertainty:Math.max(impact.uncertainty,data.source==='live'?.002:0),sessionEquivHours:elapsedEquiv,standardWindowEquivHours:STANDARD_WINDOW_EQUIV_HOURS,liquidity,ts,session,quote:q,newsDrivers:impact.drivers});
    const features:AnalogFeatures={absDrift:Math.abs(r.drift),drift:r.drift,explainedShare:explainedShare(r.components),trust:r.trust,windowType:type,sectorKey:instrument.sector,windowProgress:session.windowProgress,realisedVolRegime:1,newsCategory:news.find(n=>n.impact&&n.symbols.includes(symbol))?.category??null};
    const analogs=findAnalogs(features,withAnalogs?data.analogs:[],80,withAnalogs?scales:[1,1,1,1,1]);
    const stale=isStaleQuote(q,ts),forecast=withAnalogs&&session.isDark&&!stale&&!isAbsurdDrift(r.drift)?forecastGap(r,selected,liquidity,analogs):null;
    rows.push({instrument,quote:q,reckoning:r,liquidity,forecast,stale,analogs,features,evidence:forecast?forecastEvidence(forecast,selected).label:null,path:(frame.candles[symbol]??[]).map(c=>c.close)});
  }
  return {ts,session,news,rows,frame};
}
export function boardSentence(rows:SnapshotRow[]):string {
  if(!rows.length)return 'No instruments have a usable anchor for this window.';
  const movers=rows.filter(r=>!r.stale&&Math.abs(r.reckoning.drift)>.01);
  if(!movers.length){const widest=[...rows].sort((a,b)=>Math.abs(b.reckoning.drift)-Math.abs(a.reckoning.drift))[0]!;return `Nothing much is happening. The widest drift is ${(Math.expm1(Math.abs(widest.reckoning.drift))*100).toFixed(1)}% on ${widest.instrument.symbol}.`;}
  const market=movers.filter(r=>Math.abs(r.reckoning.components.market)>Math.abs(r.reckoning.components.total)*.6).length;
  if(market>movers.length/3)return `${market} of ${rows.length} names are moving together — this looks like a market-wide shift, not single-name news.`;
  const explained=movers.filter(r=>explainedShare(r.reckoning.components)>.6).length;
  return `${explained} ${explained===1?'name moved':'names moved'} for an observable reason, and ${movers.length-explained} did not.`;
}
export function chartReckonings(data:ArtifactSet,board:Board,symbol:string):Reckoning[]{
  const candles=board.frame.candles[symbol]??[];
  return candles.filter((_,i)=>i%Math.max(1,Math.floor(candles.length/80))===0).map(c=>{
    const ts=c.ts;
    const quotes=board.frame.quotes.map(q=>{const prior=(board.frame.candles[q.symbol]??[]).filter(b=>b.ts<=ts).at(-1);return {...q,ts,price:prior?.close??board.frame.anchors[q.symbol]!,bid:null,ask:null,volumeSinceClose:(board.frame.candles[q.symbol]??[]).filter(b=>b.ts<=ts).reduce((s,b)=>s+b.volume,0)};});
    return computeBoard(data,{...board.frame,ts,quotes},false).rows.find(r=>r.instrument.symbol===symbol)?.reckoning;
  }).filter((r):r is Reckoning=>!!r).concat(board.rows.find(r=>r.instrument.symbol===symbol)?.reckoning??[]);
}
