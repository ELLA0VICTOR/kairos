import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {DailyBar,Instrument} from '../engine/types.js';
import {ols} from '../engine/stats.js';
import {validateBeta} from '../engine/stability.js';
const source=await readFile('raw/bitget/daily-history.json','utf8');
const history=JSON.parse(source) as {universe:Instrument[];bars:Record<string,DailyBar[]>};
const previous=JSON.parse(await readFile('raw/bitget/audit.json','utf8')) as {asOf:string;instruments:Record<string,{beta:number;betaStdErr:number}>};
function gaps(symbol:string){
 const bars=[...history.bars[symbol]!].sort((a,b)=>a.date.localeCompare(b.date));
 if(new Set(bars.map(b=>b.date)).size!==bars.length)throw new Error('Duplicate dates: '+symbol);
 return new Map(bars.slice(1).map((bar,index)=>[bar.date,Math.log(bar.open/bars[index]!.close)]));
}
function fit(dates:string[],x:number[],y:number[]){
 const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
 const sxx=x.reduce((s,v)=>s+(v-mx)**2,0);
 const beta=x.reduce((s,v,i)=>s+(v-mx)*(y[i]!-my),0)/sxx;
 const intercept=my-beta*mx,sse=y.reduce((s,v,i)=>s+(v-intercept-beta*x[i]!)**2,0);
 const betaStdErr=Math.sqrt(sse/(n-2)/sxx),engine=ols(x,y);
 if(Math.abs(beta-engine.slope)>1e-10||Math.abs(betaStdErr-engine.slopeStdErr)>1e-10)throw new Error('Independent OLS mismatch');
 return {n,first:dates[0],last:dates.at(-1),beta,betaStdErr,tStat:betaStdErr?beta/betaStdErr:null};
}
const rows=history.universe.map(instrument=>{
 const own=gaps(instrument.symbol),factor=gaps(instrument.anchorFactor);
 const dates=[...own.keys()].filter(date=>factor.has(date)).sort().slice(-250);
 if(dates.length!==250)throw new Error('Expected 250 matched sessions: '+instrument.symbol);
 const x=dates.map(d=>factor.get(d)!),y=dates.map(d=>own.get(d)!);
 const full=fit(dates,x,y),prior=previous.instruments[instrument.symbol]!;
 if(Math.abs(full.beta-prior.beta)>1e-10||Math.abs(full.betaStdErr-prior.betaStdErr)>1e-10)throw new Error('Saved audit does not match history');
 const first=fit(dates.slice(0,125),x.slice(0,125),y.slice(0,125));
 const last=fit(dates.slice(125),x.slice(125),y.slice(125));
 const validation=validateBeta(x,y,instrument.symbol===instrument.anchorFactor);
 return {symbol:instrument.symbol,sector:instrument.sector,factor:instrument.anchorFactor,full,first,last,sameSign:Math.sign(first.beta)===Math.sign(last.beta),lastToFirst:Math.abs(last.beta/first.beta),estimateStability:validation.estimateStability,reasons:validation.reasons};
});
const ranking=[...rows].sort((a,b)=>b.full.beta-a.full.beta).map((r,i)=>({rank:i+1,symbol:r.symbol,sector:r.sector,factor:r.factor,beta:r.full.beta}));
const selected=rows.filter(r=>['rAAPL','rMSFT','rNVDA'].includes(r.symbol));
const result={sourceAsOf:previous.asOf,historySha256:createHash('sha256').update(source).digest('hex'),method:'OLS with intercept; ln(open/previous close), paired by date against the configured index; conventional residual standard errors with n-2 degrees of freedom; no exclusions or winsorization',selected,rows,ranking,hardFailure:selected.some(r=>r.full.tStat===null||Math.abs(r.full.tStat)<2||!r.sameSign)};
await writeFile('raw/bitget/beta-validation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
const fmt=(v:number|null)=>v===null?'identity':v.toFixed(6);
const table=['# All twenty measured beta estimates','','See [the investigation and policy](beta-validation-2026-09-22.md). No beta has been changed.','','| Rank | Name | Beta | SE | t | H1 beta | H1 t | H2 beta | H2 t | Stability |','|---:|---|---:|---:|---:|---:|---:|---:|---:|---|',...[...rows].sort((a,b)=>b.full.beta-a.full.beta).map((r,i)=>`| ${i+1} | ${r.symbol} | ${[r.full.beta,r.full.betaStdErr,r.full.tStat,r.first.beta,r.first.tStat,r.last.beta,r.last.tStat].map(fmt).join(' | ')} | ${r.estimateStability} |`)];
await writeFile('docs/beta-validation-tables.md',table.join('\n')+'\n');
