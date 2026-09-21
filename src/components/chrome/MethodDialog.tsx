import { createContext,useContext,useEffect,useRef,useState,type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDesk } from '@/data/queries';
import { pct,price } from '@/lib/format';
import { MethodContent } from './MethodContent';
const Guide = createContext<()=>void>(()=>{});
export const useMethod = ()=>useContext(Guide);
const steps = [
  {label:'Observe',title:'Markets close. Tokens don’t.',body:'Kairos starts with the last official stock price, then watches what changes while the exchange is dark.',note:'Regular and extended sessions have real price discovery. During those hours, the reckoning pauses.'},
  {label:'Explain',title:'Separate the move from the noise.',body:'Market moves, sector peers and observable news form a fair-value estimate. The difference between that estimate and the token price is drift.',note:'The band expresses uncertainty. Thin liquidity widens it. An unexplained move is a question, not a trading instruction.'},
  {label:'Resolve',title:'Every forecast meets the bell.',body:'A logged forecast is compared with the next official opening price. Misses stay in the record, right beside the hits.',note:'Skill is measured against assuming the token price is already right. Zero means the model adds nothing; negative means it did worse.'},
];
export function MethodProvider({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false),[step,setStep]=useState(0),dialog=useRef<HTMLDialogElement>(null);
  const {board}=useDesk(),row=board.rows.find(r=>r.instrument.symbol==='rTSLA')??board.rows[0];
  useEffect(()=>{const node=dialog.current;if(open&&!node?.open)node?.showModal();if(!open&&node?.open)node.close();if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
  const item=steps[step]!;
  return <Guide.Provider value={()=>{setStep(0);setOpen(true);}}>{children}
    <dialog ref={dialog} className="method-dialog" onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}} aria-labelledby="guide-title">
      <div className="guide-inner">
        <header className="guide-top"><span>KAIROS / FIELD GUIDE</span><button onClick={()=>setOpen(false)} aria-label="Close guide">✕</button></header>
        <div className="guide-tabs" role="tablist" aria-label="How Kairos works">{steps.map((s,i)=><button role="tab" aria-selected={step===i} aria-controls="guide-panel" id={`guide-tab-${i}`} tabIndex={step===i?0:-1} key={s.label} onClick={()=>setStep(i)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(i+(e.key==='ArrowRight'?1:2))%3;setStep(next);document.getElementById(`guide-tab-${next}`)?.focus();}}}><span>0{i+1}</span>{s.label}</button>)}</div>
        <section id="guide-panel" role="tabpanel" aria-labelledby={`guide-tab-${step}`} className="guide-panel" key={step}>
          <span className="guide-step">0{step+1} / 03</span><h2 id="guide-title">{item.title}</h2><p>{item.body}</p>
          <div className={`guide-visual guide-visual-${step}`}>
            {step===0?<><div className="guide-timeline"><span><i/>Official close</span><span><i/>The dark window</span><span><i/>Opening bell</span></div><svg viewBox="0 0 520 95" aria-hidden="true"><path d="M0 65H520" stroke="var(--rule-strong)" strokeDasharray="3 6"/><path className="guide-path" d="M0 65L35 62 55 68 80 59 110 56 134 61 158 46 182 49 207 35 232 39 263 26 290 36 313 23 342 28 376 17 400 25 430 12 460 16 480 8 520 11" fill="none" stroke="var(--brass)" strokeWidth="2"/></svg><div className="guide-caption"><span>STOCK EXCHANGE / CLOSED</span><span>TOKEN MARKET / STILL MOVING</span></div></>:step===1?<><div className="guide-equation"><span>Market</span><b>+</b><span>Sector</span><b>+</b><span>News</span><b>=</b><strong>Fair value</strong></div>{row&&<div className="guide-values"><div><small>{row.instrument.symbol} PRICE</small><strong>{price(row.quote.price)}</strong></div><div><small>FAIR VALUE</small><strong>{price(row.reckoning.reckonedValue)}</strong></div><div><small>DRIFT</small><strong className={row.reckoning.drift>=0?'tone-rust':'tone-verdigris'}>{pct(row.reckoning.drift)}</strong></div></div>}<p className="guide-caption">Current synthetic snapshot · prices in USDT</p></>:<><div className="guide-resolution"><span>Forecast<small>Written before the bell</small></span><span className="resolution-arrow">⟶</span><span>Outcome<small>Measured at the open</small></span></div><div className="guide-resolution-bottom"><span>IMMUTABLE FIX</span><span>MODEL VERSION + INPUT HASH</span></div></>}
          </div><p className="guide-note">{item.note}</p>
        </section>
        <footer className="guide-footer"><span>{step===2?'The record is the test.':'An estimate. Always with uncertainty.'}</span>{step<2?<button className="button primary" onClick={()=>setStep(step+1)}>Continue <span>↗</span></button>:<Link className="button primary" to="/record" onClick={()=>setOpen(false)}>Explore the record <span>↗</span></Link>}</footer>
        <MethodContent onNavigate={()=>setOpen(false)}/>
      </div>
    </dialog>
  </Guide.Provider>;
}
export function OpenMethodRoute(){const open=useMethod();const called=useRef(false);useEffect(()=>{if(!called.current){called.current=true;open();}},[open]);return null;}
