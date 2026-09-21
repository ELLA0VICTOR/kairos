import {memo,useEffect,useRef,useState} from 'react';
import {useReducedMotion} from '@/hooks/useReducedMotion';
import type {EarthState} from './earth-renderer';

export const OrbitalEarth=memo(function OrbitalEarth(){
 const canvasRef=useRef<HTMLCanvasElement>(null),send=useRef<()=>void>(()=>{});
 const reduced=useReducedMotion(),[paused,setPaused]=useState(false),[ready,setReady]=useState(false);
 const settings=useRef({paused,reduced});settings.current={paused,reduced};
 useEffect(()=>{send.current();},[paused,reduced]);
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  let disposed=false,visible=true,worker:Worker|undefined,fallback:ReturnType<typeof import('./earth-renderer').renderEarth>|undefined;
  const state:EarthState={width:1,height:1,paused,reduced,visible:true,x:0,y:0};
  const update=()=>{if(disposed)return;const box=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,1.5);Object.assign(state,{width:Math.max(1,Math.round(box.width*ratio)),height:Math.max(1,Math.round(box.height*ratio)),...settings.current,visible:visible&&!document.hidden});worker?.postMessage({state});fallback?.update({...state});};
  send.current=update;
  const resize=new ResizeObserver(update);resize.observe(canvas);
  const observer=new IntersectionObserver(([entry])=>{visible=entry?.isIntersecting??false;update();});observer.observe(canvas);
  const move=(event:PointerEvent)=>{if(settings.current.reduced||settings.current.paused)return;const rect=canvas.getBoundingClientRect();state.x=(event.clientX-rect.left)/rect.width-.5;state.y=(event.clientY-rect.top)/rect.height-.5;update();};
  canvas.addEventListener('pointermove',move);document.addEventListener('visibilitychange',update);
  // Delay transfer by one task so React StrictMode's initial cleanup can cancel it.
  const start=window.setTimeout(()=>{
   if(disposed)return;update();
   if(typeof canvas.transferControlToOffscreen==='function'){
    try{worker=new Worker(new URL('./earth.worker.ts',import.meta.url),{type:'module'});worker.onmessage=event=>{if(!disposed&&event.data==='ready')setReady(true);};worker.onerror=()=>{worker?.terminate();worker=undefined;};const offscreen=canvas.transferControlToOffscreen();worker.postMessage({canvas:offscreen,state},[offscreen]);}catch{worker?.terminate();worker=undefined;}
   }else{
    void import('./earth-renderer').then(({renderEarth})=>{if(!disposed)fallback=renderEarth(canvas,{...state},()=>{if(!disposed)setReady(true);});}).catch(()=>{});
   }
  },0);
  return()=>{disposed=true;clearTimeout(start);worker?.terminate();fallback?.dispose();resize.disconnect();observer.disconnect();canvas.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',update);send.current=()=>{};};
 },[]);

  return <div className="orbital-earth">
    <svg className="star-field" viewBox="0 0 700 550" aria-hidden="true">{Array.from({length:85},(_,i)=><circle key={i} cx={(i*173+43)%700} cy={(i*127+19)%550} r={i%7===0?1:.55} fill="white" opacity={.15+(i%5)*.1}/>)}</svg>
    <div className={`earth-fallback ${ready?'is-ready':''}`} aria-hidden="true"/>
    <canvas ref={canvasRef} aria-label="Slowly rotating Earth with intersecting orbital paths" role="img"/>
    <span className="orbital-label orbital-label-one"><i/>24/7 · ONCHAIN</span>
    <span className="orbital-label orbital-label-two"><i/>NEW YORK · 40.71° N</span>
    {!reduced&&<button className="orbit-control" onClick={()=>setPaused(!paused)} aria-label={paused?'Resume globe motion':'Pause globe motion'}>{paused?'PLAY':'PAUSE'} <span>{paused?'▷':'Ⅱ'}</span></button>}
  </div>;
});
