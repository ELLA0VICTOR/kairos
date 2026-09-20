import type { NewsCategory, SectorKey, Symbol } from './types';
import { median, stdev } from './stats';
export interface AnalogFeatures {
  absDrift:number; drift:number; explainedShare:number;trust:number;
  windowType:'overnight'|'weekend'|'holiday';sectorKey:SectorKey;windowProgress:number;
  realisedVolRegime:number;newsCategory:NewsCategory|null;
}
export interface AnalogRecord extends AnalogFeatures {id:string;symbol:Symbol;date:string;realisedGap:number}
export interface AnalogResult {
  count:number;neighbours:Array<{record:AnalogRecord;distance:number;weight:number}>;
  medianRealised:number;p10:number;p90:number;medianGivebackShare:number;revertedShare:number;
}
export type AnalogIndex = AnalogRecord[];
export function alignedGap(record:AnalogRecord,queryDrift:number):number {
  return record.drift*queryDrift<0?-record.realisedGap:record.realisedGap;
}
/** Interpolate between weighted CDF midpoints, with clamped end quantiles. */
export function weightedQuantile(values:Array<{value:number;weight:number}>,q:number):number {
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a.value-b.value),total=sorted.reduce((s,v)=>s+v.weight,0);
  if(!(total>0)||q<0||q>1)throw new Error('Invalid weighted quantile');
  let cumulative=0,previous=sorted[0]!.value,previousP=0;
  for(const item of sorted) {
    const p=(cumulative+item.weight/2)/total;
    if(q<=p)return previous+(item.value-previous)*(p===previousP?0:(q-previousP)/(p-previousP));
    cumulative+=item.weight;previous=item.value;previousP=p;
  }
  return sorted.at(-1)!.value;
}
const features=[['absDrift',3],['explainedShare',2],['trust',2],['windowProgress',1],['realisedVolRegime',1]] as const;
/** Explicit reusable scales avoid recomputing index statistics for every query. */
export function analogScales(index:AnalogRecord[]):number[] {
  return features.map(([key])=>index.length>1?stdev(index.map(r=>r[key]))||1:1);
}
export function findAnalogs(query:AnalogFeatures,index:AnalogRecord[],k=80,scales=analogScales(index)):AnalogResult {
  if(!Number.isInteger(k)||k<1)throw new Error('Analog count must be positive');
  if(!index.length)return {count:0,neighbours:[],medianRealised:0,p10:0,p90:0,medianGivebackShare:0,revertedShare:0};
  if(scales.length!==features.length||scales.some(s=>!(s>0)))throw new Error('Invalid analog scales');
  const nearest:Array<{record:AnalogRecord;distance:number;weight:number}>=[];
  const compare=(a:typeof nearest[number],b:typeof nearest[number]):number=>a.distance-b.distance||a.record.id.localeCompare(b.record.id);
  for(const record of index){
    const squared=features.reduce((s,[key,weight],i)=>s+weight*((query[key]-record[key])/scales[i]!)**2,0);
    const distance=Math.sqrt(squared)+(query.windowType!==record.windowType?2:0)+(query.sectorKey!==record.sectorKey?.8:0)+(query.newsCategory!==record.newsCategory?.5:0);
    const candidate={record,distance,weight:1/(1+distance*distance)};
    if(nearest.length===k&&compare(candidate,nearest[k-1]!)>=0)continue;
    let low=0,high=nearest.length;
    while(low<high){const middle=(low+high)>>>1;if(compare(nearest[middle]!,candidate)<=0)low=middle+1;else high=middle;}
    nearest.splice(low,0,candidate);if(nearest.length>k)nearest.pop();
  }
  const weightSum=nearest.reduce((s,n)=>s+n.weight,0);
  const neighbours=nearest.map(n=>({...n,weight:n.weight/weightSum}));
  const values=neighbours.map(n=>({value:alignedGap(n.record,query.drift),weight:n.weight}));
  const givebacks=neighbours.filter(n=>Math.abs(n.record.drift)>=.002).map(n=>-n.record.realisedGap/n.record.drift);
  return {count:neighbours.length,neighbours,medianRealised:weightedQuantile(values,.5),p10:weightedQuantile(values,.1),p90:weightedQuantile(values,.9),medianGivebackShare:givebacks.length?median(givebacks):0,revertedShare:neighbours.filter(n=>n.record.realisedGap*n.record.drift<0).length/neighbours.length};
}
