import { useId,useMemo } from 'react';
import { HOUR,regularClose,regularOpen,sessionWeight } from '@engine/calendar';
import { useSession } from '@/hooks/useSession';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { useDesk } from '@/data/queries';
import { countdown,time } from '@/lib/format';
import { line,scale } from '../charts/axis';
import { bandThickness } from '@/lib/session';
import { OrbitalEarth } from './OrbitalEarth';
import { useMethod } from './MethodDialog';

export function SessionBar({intro=false,compact=false}:{intro?:boolean;compact?:boolean}){
  const {now,session}=useSession(),{board}=useDesk(),{ref,width}=useResizeObserver(),id=useId().replaceAll(':',''),openMethod=useMethod();
  const regular=session.state==='regular';
  const start=regular?regularOpen(new Date(now)).getTime():session.anchorCloseTs,end=regular?regularClose(new Date(now)).getTime():session.nextOpenTs;
  const x=scale(start,end,1,width-1),current=Math.min(width-1,Math.max(1,x(now))),progress=Math.max(0,Math.min(1,(now-start)/(end-start)));
  const points=useMemo(()=>{const values:Array<{ts:number;x:number;h:number}>=[];if(compact)return values;for(let ts=start;ts<end;ts+=HOUR/4)values.push({ts,x:x(ts),h:bandThickness(ts,end,regular)*.55});values.push({ts:end,x:width-1,h:15});return values;},[start,end,width,regular,compact]);
  const path=line(points.map(p=>[p.x,22-p.h/2]))+' '+line([...points].reverse().map(p=>[p.x,22+p.h/2])).replace('M','L')+' Z';
  const accessiblePoints=useMemo(()=>points.map(p=><tr key={p.ts}><th>{time(p.ts)}</th><td>{sessionWeight(p.ts)}</td></tr>),[points]);
  if(compact)return <section className="session-compact" aria-label="Exchange session"><span><i className="status-dot"/>{session.isDark?'EXCHANGE CLOSED':regular?'EXCHANGE OPEN':'EXTENDED HOURS'}</span><span>{regular?'Session ends':'Opening bell'} <strong>{time(end)} NY</strong></span><span className="compact-countdown" aria-live="off">{countdown(end-now)} remaining</span></section>;
  return <section className={`session-bar ${intro?'intro':''}`} aria-label="Exchange session">
    <div className="session-top"><div className="session-story">
      <div className="session-label"><span className="status-dot"/>{session.isDark?'EXCHANGE OFFLINE / TOKENS ONLINE':regular?'EXCHANGE ONLINE':'EXTENDED SESSION'}</div>
      <h1>{session.isDark?<>The market<br/>never <span>sleeps.</span></>:<>The opening bell.<br/><span>A new perspective.</span></>}</h1>
      <p>Stocks have closing hours. Their tokens don’t.<br/>Know what’s moving. Understand what’s behind it.</p>
      <button className="hero-link" onClick={()=>document.getElementById('markets')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}>Explore the market <span>↘</span></button>
      <div className="countdown-block" aria-live="off"><div><span className="label">{regular?'SESSION CLOSES IN':'NEXT OPENING BELL'}</span><div className="countdown">{countdown(end-now)}</div></div><span className="session-end">{time(end,'America/New_York','EEE, dd MMM')}<br/>{time(end,'America/New_York','HH:mm')} NEW YORK</span></div>
    </div><OrbitalEarth/></div>
    <div className="session-timeline"><div className="timeline-label"><span>{time(start,'America/New_York','EEE HH:mm')}<small>OFFICIAL CLOSE</small></span></div><div className="session-track" ref={ref}><svg width={width} height={44} role="img" aria-label={`${Math.round(progress*100)}% of the close-to-bell window elapsed.`}><defs><clipPath id={id}><rect className="elapsed-clip" width={current} height="44"/></clipPath></defs><path d={path} fill="var(--session-track)"/><path d={path} fill="var(--session-elapsed)" clipPath={`url(#${id})`}/>{board.news.filter(n=>n.ts>=start&&n.ts<=now&&n.ts<end).map(n=><circle key={n.id} cx={x(n.ts)} cy={22} r={n.impact?2.5:1.5} fill="var(--orbit-accent)"><title>{n.headline}</title></circle>)}<line x1={current} x2={current} y1={6} y2={38} stroke="var(--brass)"/><circle cx={current} cy={22} r={3} fill="var(--brass)"/></svg><table className="sr-only"><caption>Session uncertainty by New York time</caption><tbody>{accessiblePoints}</tbody></table></div><div className="timeline-label timeline-end"><span>{time(end,'America/New_York','EEE HH:mm')}<small>OPENING BELL</small></span></div><button className="timeline-help" onClick={openMethod} aria-label="Explain the session timeline">?</button></div>
  </section>;
}
