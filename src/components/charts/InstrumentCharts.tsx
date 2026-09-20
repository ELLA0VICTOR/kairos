import { useEffect,useState } from 'react';
import type { Attribution,GapForecast,Reckoning,SessionInfo } from '@engine/types';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { pct,price,time as timeNY } from '@/lib/format';
import { line,scale,ticks } from './axis';

export function ChartTable({label,heads,rows}:{label:string;heads:string[];rows:(string|number)[][]}){
 return <table className="sr-only"><caption>{label}</caption><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>;
}
export function Waterfall({value}:{value:Attribution}){
 const {ref,width}=useResizeObserver(),keys=['market','sector','news','unaccounted','total'] as const;
 const limit=Math.max(.001,...keys.map(k=>Math.abs(value[k]))),x=scale(-limit,limit,110,Math.max(150,width-85)),zero=x(0);
 return <div ref={ref} className="chart waterfall"><svg width={width} height={220} role="img" aria-label="Market, sector, news and unaccounted log returns sum to the total move.">
  <line x1={zero} x2={zero} y1={4} y2={211} stroke="var(--rule-strong)"/>
  {keys.map((k,i)=>{const y=20+i*40,v=value[k],detail=k==='news'?value.newsDrivers.map(n=>`${n.headline}: ${pct(n.contribution)}`).join('; '):`${k}: ${pct(v)}`;return <g key={k} tabIndex={0} aria-label={detail||'No news contribution'}><title>{detail||'No news contribution'}</title><text x={0} y={y+4} className="axis-text">{k[0]!.toUpperCase()+k.slice(1)}</text>{i===4&&<line x1={0} x2={width} y1={y-22} y2={y-22} stroke="var(--rule)"/>}<rect data-component={k} data-value={v} x={Math.min(zero,x(v))} y={y-9} width={Math.max(v===0?0:1,Math.abs(x(v)-zero))} height={18} fill={k==='unaccounted'?'none':k==='news'?'var(--brass)':k==='total'?'var(--bone)':'var(--bone-dim)'} stroke={k==='unaccounted'?'var(--bone)':'none'}/><text x={width} y={y+4} textAnchor="end" className="chart-value">{pct(v)}</text></g>;})}
 </svg><ChartTable label="Attribution (additive log returns; displayed percentages are rounded)" heads={['Component','Log return']} rows={keys.map(k=>[k,value[k]])}/></div>;
}
const stepped=(points:Array<[number,number]>)=>points.map(([x,y],i)=>i?`H${x} V${y}`:`M${x},${y}`).join(' ');
export function ReckoningChart({points,session,symbol}:{points:Reckoning[];session:SessionInfo;symbol:string}){
 const {ref,width}=useResizeObserver(),[cursor,setCursor]=useState<number|null>(null);
 useEffect(()=>setCursor(null),[symbol]);
 const lo=Math.min(...points.flatMap(p=>[p.bandLow,p.tokenPrice,p.anchorPrice])),hi=Math.max(...points.flatMap(p=>[p.bandHigh,p.tokenPrice,p.anchorPrice]));
 const pad=(hi-lo)*.12||1,x=scale(session.anchorCloseTs,session.nextOpenTs,56,width-16),y=scale(lo-pad,hi+pad,242,52),last=points.at(-1);
 const selected=points[cursor??points.length-1],upper=points.map(p=>[x(p.ts),y(p.bandHigh)] as [number,number]),lower=points.map(p=>[x(p.ts),y(p.bandLow)] as [number,number]).reverse();
 return <div ref={ref} className="chart reckoning-chart"><svg width={width} height={280} role="img" tabIndex={0} aria-label={`${symbol} price, reckoning and 80% band. Use left and right arrow keys to inspect observations.`} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setCursor(Math.max(0,Math.min(points.length-1,(cursor??points.length-1)+(e.key==='ArrowRight'?1:-1))));}}} onPointerMove={e=>{const px=e.clientX-e.currentTarget.getBoundingClientRect().left;setCursor(points.reduce((best,p,i)=>Math.abs(x(p.ts)-px)<Math.abs(x(points[best]!.ts)-px)?i:best,0));}} onPointerLeave={()=>setCursor(null)}>
  {last&&<rect x={x(last.ts)} y={52} width={Math.max(0,width-16-x(last.ts))} height={190} fill="var(--ink-sunken)"/>}
  {ticks(lo-pad,hi+pad).map(t=><g key={t}><line x1={56} x2={width-16} y1={y(t)} y2={y(t)} stroke="var(--rule)" opacity={.5}/><text x={48} y={y(t)+4} textAnchor="end" className="axis-text">{price(t)}</text></g>)}
  {last&&<><line x1={56} x2={width-16} y1={y(last.anchorPrice)} y2={y(last.anchorPrice)} stroke="var(--rule-strong)" strokeDasharray="4 4"/><text x={60} y={y(last.anchorPrice)-6} className="axis-text">Official close {price(last.anchorPrice)}</text></>}
  {!!upper.length&&<path d={`${stepped(upper)} L${lower[0]![0]},${lower[0]![1]} ${stepped(lower).replace(/^M[^ ]+/, '')} Z`} fill="var(--bone-dim)" opacity={.08}/>}
  <path d={line(points.map(p=>[x(p.ts),y(p.reckonedValue)]))} fill="none" stroke="var(--bone-dim)" strokeWidth={1.5}/>
  {points.slice(1).map((p,i)=><path key={p.ts} d={line([[x(points[i]!.ts),y(points[i]!.tokenPrice)],[x(p.ts),y(p.tokenPrice)]])} fill="none" stroke={p.tokenPrice>p.bandHigh?'var(--rust)':p.tokenPrice<p.bandLow?'var(--verdigris)':'var(--bone)'} strokeWidth={2}/>)}
  {selected&&<><line x1={x(selected.ts)} x2={x(selected.ts)} y1={52} y2={242} stroke="var(--brass)" opacity={cursor===null?0:1}/><text x={width-12} y={14} textAnchor="end" className="chart-value">{timeNY(selected.ts)} NY · Traded {price(selected.tokenPrice)} USDT</text><text x={width-12} y={34} textAnchor="end" className="axis-text">Reckoned {price(selected.reckonedValue)} · 80% {price(selected.bandLow)}–{price(selected.bandHigh)}</text></>}
  <text x={56} y={269} className="axis-text">{timeNY(session.anchorCloseTs)} NY</text><text x={width-16} y={269} textAnchor="end" className="axis-text">Bell · {timeNY(session.nextOpenTs)} NY</text>
 </svg><ChartTable label={`${symbol} price and reckoning history`} heads={['Time UTC','Traded USDT','Reckoned USDT','80% low','80% high']} rows={points.map(p=>[new Date(p.ts).toISOString(),p.tokenPrice,p.reckonedValue,p.bandLow,p.bandHigh])}/></div>;
}
export function ForecastCone({forecast:f,outcomes}:{forecast:GapForecast;outcomes:number[]}){
 const {ref,width}=useResizeObserver(),lo=Math.min(0,f.p10,...outcomes),hi=Math.max(0,f.p90,...outcomes),pad=(hi-lo)*.1||.01,y=scale(lo-pad,hi+pad,200,24),start=52,end=width-64;
 return <div ref={ref} className="chart"><svg width={width} height={240} role="img" aria-label={`Forecast median ${pct(f.median)}, 80% interval ${pct(f.p10)} to ${pct(f.p90)}; ${outcomes.length} aligned historical outcomes at the bell.`}>
 {ticks(lo,hi).map(t=><g key={t}><line x1={start} x2={end} y1={y(t)} y2={y(t)} stroke="var(--rule)" opacity={.5}/><text x={44} y={y(t)+4} textAnchor="end" className="axis-text">{pct(t)}</text></g>)}
 <line x1={start} x2={end} y1={y(0)} y2={y(0)} stroke="var(--rule-strong)" strokeWidth={2}/><path d={`M${start},${y(0)} Q${start+(end-start)*.3},${y(f.p90)*.5+y(0)*.5} ${end},${y(f.p90)} L${end},${y(f.p10)} Q${start+(end-start)*.3},${y(f.p10)*.5+y(0)*.5} ${start},${y(0)}Z`} fill="var(--bone-dim)" opacity={.1}/>
 {outcomes.map((v,i)=><circle className="analog-outcome" key={i} cx={end} cy={y(v)+(i%3-1)*.7} r={2} fill="var(--bone-faint)" opacity={.5}><title>{`${pct(v)} aligned historical outcome`}</title></circle>)}
 <path d={line([[start,y(0)],[end,y(f.median)]])} fill="none" stroke="var(--bone)" strokeWidth={1.5}/><text x={end+5} y={y(f.median)-6} className="chart-value">{pct(f.median)}</text><text x={start} y={228} className="axis-text">Now · no change</text><text x={end} y={228} textAnchor="end" className="axis-text">At the bell</text>
 </svg><ChartTable label="Forecast and sign-aligned analog outcomes (log returns)" heads={['Measure','Log return']} rows={[["Median",f.median],["10th percentile",f.p10],["90th percentile",f.p90],...outcomes.map((v,i):[string,number]=>[`Analog ${i+1}`,v])]}/></div>;
}
export function AnalogStrip({outcomes,median,forecast}:{outcomes:number[];median:number;forecast:number}){
 const {ref,width}=useResizeObserver(),x=scale(Math.min(...outcomes,median,forecast),Math.max(...outcomes,median,forecast),12,width-12);
 return <div ref={ref} className="chart"><svg width={width} height={40} role="img" aria-label="Historical outcome distribution; brass marks the analog median and bone marks the forecast median.">{outcomes.map((v,i)=><circle key={i} cx={x(v)} cy={20+(i%3-1)*4} r={1.5} fill="var(--bone-faint)"/>)}<line x1={x(median)} x2={x(median)} y1={0} y2={40} stroke="var(--brass)"/><line x1={x(forecast)} x2={x(forecast)} y1={0} y2={40} stroke="var(--bone)"/></svg><ChartTable label="Analog strip log returns" heads={['Observation','Log return']} rows={[...outcomes.map((v,i)=>[i+1,v]),['Analog median',median],['Forecast median',forecast]]}/></div>;
}
