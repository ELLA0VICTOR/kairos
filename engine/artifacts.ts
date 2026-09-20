import type { AnalogFeatures, AnalogRecord } from './analogs';
import type { CorporateAction } from './score';
import type { ReversionBuckets } from './params';
import type { DailyBar, Fix, GapForecast, Instrument, InstrumentParams, NewsItem, Quote, Reckoning, SessionInfo } from './types';
import type { LiquidityAssessment } from './liquidity';
export const SCHEMA_VERSION=1;
export interface Artifact<T> {schemaVersion:1;generatedAt:number;modelVersion:string;source:'live'|'synthetic';data:T}
export interface ExpectedVolume {symbol:string;windowType:AnalogFeatures['windowType'];hourBucket:number;median:number;nObs:number}
export interface ParamsArtifact {
  instruments:Record<string,InstrumentParams>;buckets:Record<string,ReversionBuckets>;
  expectedVolumes:ExpectedVolume[];corporateActions:CorporateAction[];
}
export interface SnapshotRow {instrument:Instrument;quote:Quote;reckoning:Reckoning;forecast:GapForecast|null;liquidity:LiquidityAssessment;evidence:string|null;stale:boolean}
export interface Snapshot {ts:number;session:SessionInfo;rows:SnapshotRow[];news:NewsItem[]}
export interface HistoricalWindow {anchorCloseTs:number;targetOpenTs:number;type:AnalogFeatures['windowType']}
export interface RawHistory {universe:Instrument[];bars:Record<string,DailyBar[]>;windows:HistoricalWindow[]}
export interface ArtifactSet {universe:Instrument[];params:ParamsArtifact;analogs:AnalogRecord[];snapshot:Snapshot;ledgerLive:Fix[];ledgerBacktest:Fix[]}
/** Compact records use dictionary indices and fixed-point numeric features. */
export interface CompactAnalogs {
  columns:readonly string[];symbols:Instrument[];windows:HistoricalWindow[];
  categories:Array<AnalogFeatures['newsCategory']>;scale:number;
  rows:Array<[number,number,number,number,number,number,number,number,number]>;
}
export const ANALOG_COLUMNS=['window','symbol','progress','signedDrift','explainedShare','trust','volRegime','newsCategory','realisedGap'] as const;
export function packAnalogs(records:AnalogRecord[],symbols:Instrument[],windows:HistoricalWindow[]):CompactAnalogs {
  const scale=100000,categories:Array<AnalogFeatures['newsCategory']>=[null];
  const windowIds=new Map(windows.map((w,i)=>[w.anchorCloseTs,i]));
  const symbolIds=new Map(symbols.map((s,i)=>[s.symbol,i]));
  const rows:CompactAnalogs['rows']=records.map(r=>{
    const anchor=Number(r.id.split(':')[1]);
    const window=windowIds.get(anchor),symbol=symbolIds.get(r.symbol);
    if(window===undefined||symbol===undefined)throw new Error('Analog dictionary entry missing');
    let category=categories.indexOf(r.newsCategory);if(category<0){categories.push(r.newsCategory);category=categories.length-1;}
    return [window,symbol,Math.round(r.windowProgress*100),Math.round(r.drift*scale),Math.round(r.explainedShare*1000),Math.round(r.trust*1000),Math.round(r.realisedVolRegime*1000),category,Math.round(r.realisedGap*scale)];
  });
  return {columns:ANALOG_COLUMNS,symbols,windows,categories,scale,rows};
}
export function unpackAnalogs(compact:CompactAnalogs):AnalogRecord[] {
  if(JSON.stringify(compact.columns)!==JSON.stringify(ANALOG_COLUMNS)||compact.scale!==100000)throw new Error('Unsupported analog column schema');
  return compact.rows.map(([wi,si,progress,drift,explained,trust,vol,ni,gap])=>{
    const w=compact.windows[wi],s=compact.symbols[si];if(!w||!s||compact.categories[ni]===undefined)throw new Error('Malformed analog dictionary');
    return {id:`${s.symbol}:${w.anchorCloseTs}:${progress}`,symbol:s.symbol,date:new Date(w.anchorCloseTs).toISOString().slice(0,10),drift:drift/compact.scale,absDrift:Math.abs(drift)/compact.scale,explainedShare:explained/1000,trust:trust/1000,windowType:w.type,sectorKey:s.sector,windowProgress:progress/100,realisedVolRegime:vol/1000,newsCategory:compact.categories[ni]!,realisedGap:gap/compact.scale};
  });
}
