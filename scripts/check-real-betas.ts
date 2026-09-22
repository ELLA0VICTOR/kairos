import {readFile,writeFile} from 'node:fs/promises';
import type {DailyBar,Instrument} from '../engine/types.js';
// Independent covariance calculation, without importing the engine estimator.
const history=JSON.parse(await readFile('raw/bitget/daily-history.json','utf8')) as {universe:Instrument[];bars:Record<string,DailyBar[]>};
const gapMap=(bars:DailyBar[])=>new Map(bars.slice(1).map((b,index)=>[b.date,Math.log(b.open/bars[index]!.close)]));
function slope(pairs:Array<[number,number]>){const x=pairs.reduce((s,p)=>s+p[0],0)/pairs.length,y=pairs.reduce((s,p)=>s+p[1],0)/pairs.length;return pairs.reduce((s,p)=>s+(p[0]-x)*(p[1]-y),0)/pairs.reduce((s,p)=>s+(p[0]-x)**2,0);}
const audit=JSON.parse(await readFile('raw/bitget/audit.json','utf8')) as {instruments:Record<string,{beta:number}>};
const rows=history.universe.map(i=>{const own=gapMap(history.bars[i.symbol]!),factor=gapMap(history.bars[i.anchorFactor]!);const dates=[...own.keys()].filter(d=>factor.has(d)).sort().slice(-250);const pairs=dates.map(d=>[factor.get(d)!,own.get(d)!] as [number,number]);const independent=slope(pairs);if(Math.abs(independent-audit.instruments[i.symbol]!.beta)>1e-10)throw new Error('Estimator mismatch '+i.symbol);return {symbol:i.symbol,nObs:pairs.length,first:dates[0],last:dates.at(-1),beta:independent,excludingLargeGaps:slope(pairs.filter(p=>Math.abs(p[0])<.05&&Math.abs(p[1])<.05)),engineMatches:true};});
await writeFile('raw/bitget/beta-crosscheck.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows.filter(r=>['rAAPL','rMSFT','rNVDA','rAMD','rMU'].includes(r.symbol)),null,2));
