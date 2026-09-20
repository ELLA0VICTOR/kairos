import { NavLink } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { replayTs,useDesk } from '@/data/queries';
import { age,time } from '@/lib/format';
export function Masthead({lastSymbol}:{lastSymbol:string}){
  const {wallNow}=useSession(),{generatedAt}=useDesk(),elapsed=Math.max(0,wallNow-generatedAt);
  return <><a className="skip" href="#main">Skip to main content</a><header className="masthead"><div className="masthead-inner"><NavLink to="/" className="wordmark" aria-label="Kairos home">Kairos</NavLink><nav aria-label="Main navigation"><NavLink to="/" end>Window</NavLink><NavLink to={`/instrument/${lastSymbol}`}>Instrument</NavLink><NavLink to="/record">Record</NavLink><NavLink to="/ask">Ask</NavLink><NavLink to="/method">Method</NavLink></nav><div className="masthead-meta"><span className={elapsed>7200000?'tone-rust':elapsed>1800000?'tone-amber':''}>{generatedAt>wallNow?'Snapshot '+time(generatedAt,'UTC','dd MMM HH:mm')+' UTC':'Snapshot '+age(elapsed)+' old'}</span><span>{time(wallNow,'UTC','HH:mm')} UTC / {time(wallNow,'America/New_York','HH:mm')} NY</span></div></div></header><div className="demo-banner">Demo mode — synthetic data. Live data resumes when the Bitget feed reconnects.{replayTs!==undefined&&<span> Replay: {time(replayTs,'UTC','dd MMM yyyy HH:mm')} UTC.</span>}</div></>;
}
