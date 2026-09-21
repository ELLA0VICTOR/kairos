import { useEffect,useRef,useState } from 'react';
import { BrowserRouter,Link,Route,Routes,useLocation } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { DataProvider,replayTs,useDesk } from '@/data/queries';
import { Masthead } from '@/components/chrome/Masthead';
import { MethodProvider,OpenMethodRoute,useMethod } from '@/components/chrome/MethodDialog';
import { Boundary } from '@/components/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { time } from '@/lib/format';
import Window from '@/routes/Window';
import Instrument from '@/routes/Instrument';
import Record from '@/routes/Record';
import Ask from '@/routes/Ask';
const client=new QueryClient({defaultOptions:{queries:{refetchOnWindowFocus:false}}});
function Footer(){const open=useMethod(),{generatedAt}=useDesk();return <footer className="footer"><span>kairos.</span><div><span>Simulated market data · Snapshot {time(generatedAt,'UTC','dd MMM HH:mm')} UTC</span>{replayTs!==undefined&&<span>Replay {time(replayTs,'UTC','dd MMM HH:mm')} UTC</span>}</div><button onClick={open}>Method & limitations ↗</button></footer>;}
function Shell(){
  const location=useLocation(),reduced=useReducedMotion(),seen=useRef(false);
  const [intro,setIntro]=useState(()=>location.pathname==='/'&&!reduced),[lastSymbol,setLastSymbol]=useState('rNVDA');
  useEffect(()=>{if(location.pathname==='/'&&!seen.current){seen.current=true;setIntro(!reduced);}},[location.pathname,reduced]);
  useEffect(()=>{if(!intro)return;const timer=setTimeout(()=>setIntro(false),1100);return()=>clearTimeout(timer);},[intro]);
  useEffect(()=>{const symbol=location.pathname.match(/^\/instrument\/([^/]+)/)?.[1];if(symbol)setLastSymbol(symbol);},[location.pathname]);
  return <><Masthead lastSymbol={lastSymbol}/><main id="main" tabIndex={-1} className="page"><Boundary key={location.pathname.split('/')[1]??'window'} name={location.pathname}><Routes>
    <Route path="/" element={<Window intro={intro}/>}/>
    <Route path="/instrument/:symbol" element={<Instrument/>}/>
    <Route path="/record" element={<Record/>}/>
    <Route path="/method" element={<><Window intro={false}/><OpenMethodRoute/></>}/>
    <Route path="/ask" element={<Ask/>}/>
    <Route path="*" element={<div className="empty"><h1>Outside the window.</h1><Link to="/">Return to markets ↗</Link></div>}/>
  </Routes></Boundary></main><Footer/></>;
}
export default function App(){return <QueryClientProvider client={client}><BrowserRouter><DataProvider><MethodProvider><Shell/></MethodProvider></DataProvider></BrowserRouter></QueryClientProvider>;}
