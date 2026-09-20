import type {Fix,FixOrigin,SectorKey} from '@engine/types';
import type {RecordStats} from '@engine/score';
import {trustLabel} from '@engine/liquidity';
export const signedScore=(value:number):string=>`${value<0?'−':'+'}${Math.abs(value).toFixed(2)}`;
export function skillSentence(stats:RecordStats):string{
 if(!stats.n)return 'No resolved fixes yet. There is no measured skill to report.';
 if(stats.skillScore<0)return 'The model performs worse than assuming the token price is already right.';
 return stats.skillScore>0?'The model beats the unchanged-token-price baseline.':'The model adds nothing to the unchanged-token-price baseline.';
}
export function trustSentence(stats:RecordStats):string{
 const {thin,deep}=stats.byTrust;
 if(!thin.n||!deep.n)return 'There are not enough resolved fixes across thin and deep books to compare the thesis.';
 if(thin.skillScore>0&&thin.skillScore>deep.skillScore)return 'The model has more skill on thin books than deep ones. That supports the liquidity part of the thesis; trust buckets alone do not establish whether news explains the move.';
 return 'The results do not support greater model skill on thin books. The trust split contradicts that part of the thesis; the record cannot establish a cause.';
}
export interface LedgerFilter {origin:FixOrigin;sector:SectorKey|'all';trust:'thin'|'moderate'|'deep'|'all'}
export function filterLedger(rows:Fix[],filter:LedgerFilter,sectors:Record<string,SectorKey>):Fix[]{return rows.filter(f=>f.origin===filter.origin&&(filter.sector==='all'||sectors[f.symbol]===filter.sector)&&(filter.trust==='all'||trustLabel(f.trust)===filter.trust)).sort((a,b)=>b.loggedAt-a.loggedAt||a.id.localeCompare(b.id));}
/** Central 90% binomial prediction interval around a calibrated probability, using
 * log probabilities to remain stable for large n and probabilities near 0/1. */
export function binomialBand(p:number,n:number):[number,number]{
 if(n<1)return [0,1];if(p<=0)return [0,0];if(p>=1)return [1,1];
 const logs=[n*Math.log1p(-p)];for(let k=1;k<=n;k++)logs.push(logs[k-1]!+Math.log(n-k+1)-Math.log(k)+Math.log(p)-Math.log1p(-p));
 const largest=Math.max(...logs),mass=logs.map(l=>Math.exp(l-largest)),total=mass.reduce((s,v)=>s+v,0);
 let cumulative=0,low=0,high=n,found=false;for(let k=0;k<=n;k++){cumulative+=mass[k]!/total;if(!found&&cumulative>=.05){low=k;found=true;}if(cumulative>=.95){high=k;break;}}
 return [low/n,high/n];
}
