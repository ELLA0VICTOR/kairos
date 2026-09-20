import { useId,useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { HOUR, regularClose, regularOpen, sessionWeight } from '@engine/calendar';
import { useSession } from '@/hooks/useSession';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { useDesk } from '@/data/queries';
import { countdown,time,pct } from '@/lib/format';
import { Tooltip } from '../primitives';
import { line,scale } from '../charts/axis';
import { bandThickness } from '@/lib/session';
export function SessionBar({intro}:{intro:boolean}){
  const {now,session}=useSession(),{board}=useDesk(),{pathname}=useLocation(),{ref,width}=useResizeObserver(),id=useId().replaceAll(':','');
  const condensed=['/record','/ask','/method'].includes(pathname),regular=session.state==='regular';
  const start=regular?regularOpen(new Date(now)).getTime():session.anchorCloseTs,end=regular?regularClose(new Date(now)).getTime():session.nextOpenTs;
  const narrow=width<550,x=scale(start,end,1,width-1),current=Math.min(width-1,Math.max(1,x(now)));
  const points=useMemo(()=>{const p:Array<{ts:number;x:number;h:number}>=[];for(let t=start;t<end;t+=HOUR/4)p.push({ts:t,x:x(t),h:narrow?8:bandThickness(t,end,regular)});p.push({ts:end,x:width-1,h:narrow?8:28});return p;},[start,end,width,narrow,regular]);
  const path=line(points.map(p=>[p.x,42-p.h/2]))+' '+line([...points].reverse().map(p=>[p.x,42+p.h/2])).replace('M','L')+' Z';
  const label=regular?'Exchange open — live price discovery':session.isDark?'Exchange dark':'Extended session';
  return <section className={`session-bar ${condensed?'condensed':''} ${intro?'intro':''}`} aria-label="Exchange session">
    <div className="session-inner">
      <div className="session-track"><div className="session-label"><span>{label}</span><span className="window-kind">{session.isDark?`${session.state[0]!.toUpperCase()}${session.state.slice(1)} window`:'Real exchange price discovery'}</span><Tooltip label="How to read the session band">The band is thicker where time carries more uncertainty. A Saturday afternoon tells us less than a Monday pre-open hour, so it counts for less.</Tooltip></div>
        <div ref={ref}><svg width={width} height={condensed?30:88} viewBox={`0 0 ${width} 88`} role="img" aria-label={`${label}. ${Math.round(session.windowProgress*100)}% of the anchor-to-bell window elapsed.`}>
          <defs><clipPath id={id}><rect className="elapsed-clip" width={current} height="88"/></clipPath></defs>
          <path d={path} fill="var(--ink-sunken)" stroke="var(--rule)"/>
          <path d={path} fill="var(--ink-raised)" stroke="var(--rule-strong)" clipPath={`url(#${id})`}/>
          {!narrow&&Array.from({length:Math.ceil((end-start)/HOUR)},(_,i)=>{const t=start+i*HOUR,major=i%6===0;return <g key={i}><line x1={x(t)} x2={x(t)} y1="60" y2={major?69:64} stroke={major?'var(--rule-strong)':'var(--rule)'}/>{major&&x(t)<width-65&&<text x={Math.max(2,x(t))} y="83" className="axis-text">{time(t,'America/New_York','EEE HH:mm')}</text>}</g>;})}
          {!narrow&&!condensed&&board.news.filter(n=>n.ts>=start&&n.ts<=now&&n.ts<end).map(n=>{const size=4+Math.min(6,Math.abs(n.impact??0)*150);return <g key={n.id} tabIndex={0} aria-label={`${n.headline}. ${n.source}. ${n.impact===null?'Impact unknown':pct(n.impact)}`}><title>{n.headline} — {n.source} — {n.impact===null?'Impact unknown':pct(n.impact)}</title><rect x={x(n.ts)-size/2} y={18-size/2} width={size} height={size} transform={`rotate(45 ${x(n.ts)} 18)`} fill={n.impact?'var(--brass)':'none'} stroke="var(--brass)"/></g>;})}
          <g className="now-mark"><line x1={current} x2={current} y1="0" y2="70" stroke="var(--brass)"/><rect x={current-1.5} y="40.5" width="3" height="3" fill="var(--brass)"/></g>
        </svg></div>
        <table className="sr-only"><caption>Session uncertainty by New York time</caption><tbody>{points.map(p=><tr key={p.ts}><th>{time(p.ts)}</th><td>{sessionWeight(p.ts)}</td></tr>)}</tbody></table>
      </div>
      <div className="countdown-block" aria-live="off"><span className="label">{regular?'Regular session ends in':'Next sighting in'}</span><div className="countdown">{countdown(end-now)}</div><span className="session-end">{time(end)} New York</span></div>
    </div>
  </section>;
}
