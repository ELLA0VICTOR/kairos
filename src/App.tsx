import { lazy,Suspense,useEffect,useRef,useState } from 'react';
import { BrowserRouter,Link,Route,Routes,useLocation } from 'react-router-dom';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { DataProvider,replayTs,useDesk } from '@/data/queries';
import { Masthead } from '@/components/chrome/Masthead';
import { MethodProvider,OpenMethodRoute,useMethod } from '@/components/chrome/MethodDialog';
import { Boundary } from '@/components/primitives';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { time } from '@/lib/format';
import Window from '@/routes/Window';
const Instrument=lazy(()=>import('@/routes/Instrument'));
const Record=lazy(()=>import('@/routes/Record'));
const Ask=lazy(()=>import('@/routes/Ask'));
const client=new QueryClient({defaultOptions:{queries:{refetchOnWindowFocus:false}}});
function DataModeNotice(){const {data}=useDesk();return data.source==='live'?null:<p className="notice" role="status" data-demo-banner>Demo mode — synthetic market data.</p>;}
function Footer(){const open=useMethod(),{generatedAt,data}=useDesk();return <footer className="footer"><span>kairos.</span><div><span>{data.source==='live'?'Bitget quotes · Real daily history · Cold-start forecast':'Simulated market data'} · Snapshot {time(generatedAt,'UTC','dd MMM HH:mm')} UTC</span>{replayTs!==undefined&&<span>Replay {time(replayTs,'UTC','dd MMM HH:mm')} UTC</span>}</div><button onClick={open}>Method & limitations ↗</button></footer>;}
function Shell(){
  const location=useLocation(),reduced=useReducedMotion(),seen=useRef(false);
  const [intro,setIntro]=useState(()=>location.pathname==='/'&&!reduced),[lastSymbol,setLastSymbol]=useState('rNVDA');
  const previousPath=useRef(location.pathname);
  useEffect(()=>{if(previousPath.current!==location.pathname){previousPath.current=location.pathname;if(location.pathname!=='/method')document.getElementById('main')?.focus();}},[location.pathname]);
  useEffect(()=>{if(location.pathname==='/'&&!seen.current){seen.current=true;setIntro(!reduced);}},[location.pathname,reduced]);
  useEffect(()=>{if(!intro)return;const timer=setTimeout(()=>setIntro(false),1100);return()=>clearTimeout(timer);},[intro]);
  useEffect(()=>{const symbol=location.pathname.match(/^\/instrument\/([^/]+)/)?.[1];if(symbol)setLastSymbol(symbol);},[location.pathname]);
  return <><Masthead lastSymbol={lastSymbol}/><main id="main" tabIndex={-1} className="page"><Boundary key={location.pathname.split('/')[1]??'window'} name={location.pathname}><Suspense fallback={<p role="status">Loading view�</p>}><Routes>
    <Route path="/" element={<><DataModeNotice/><Window intro={intro}/></>}/>
    <Route path="/instrument/:symbol" element={<><DataModeNotice/><Instrument/></>}/>
    <Route path="/record" element={<><DataModeNotice/><Record/></>}/>
    <Route path="/method" element={<><DataModeNotice/><Window intro={false}/><OpenMethodRoute/></>}/>
    <Route path="/ask" element={<><DataModeNotice/><Ask/></>}/>
    <Route path="*" element={<div className="empty"><h1>Outside the window.</h1><Link to="/">Return to markets ↗</Link></div>}/>
  </Routes></Suspense></Boundary></main><Footer/></>;
}
export default function App(){return <QueryClientProvider client={client}><BrowserRouter><DataProvider><MethodProvider><Shell/></MethodProvider></DataProvider></BrowserRouter></QueryClientProvider>;}
