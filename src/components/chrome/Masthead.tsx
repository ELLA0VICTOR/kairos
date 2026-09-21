import { NavLink } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { time } from '@/lib/format';
import { BrandMark } from '@/components/primitives/Icon';
import { useMethod } from './MethodDialog';

export function Masthead({lastSymbol}:{lastSymbol:string}){
  const {wallNow}=useSession(),openMethod=useMethod();
  return <><a className="skip" href="#main">Skip to main content</a>
    <header className="masthead"><div className="masthead-inner">
      <NavLink to="/" className="wordmark" aria-label="Kairos home"><BrandMark/><span>kairos<span className="wordmark-dot">.</span></span></NavLink>
      <nav aria-label="Main navigation"><NavLink to="/" end>Markets</NavLink><NavLink to={`/instrument/${lastSymbol}`}>Instrument</NavLink><NavLink to="/record">The record</NavLink><NavLink to="/ask">Ask Kairos</NavLink></nav>
      <div className="masthead-right"><span className="nav-clock">NYC <strong>{time(wallNow,'America/New_York','HH:mm:ss')}</strong></span><button className="method-trigger" onClick={openMethod}>How it works <span>↗</span></button></div>
    </div></header>
  </>;
}
