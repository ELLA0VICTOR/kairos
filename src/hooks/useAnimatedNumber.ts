import { useEffect,useRef,useState } from 'react';
import { useReducedMotion } from './useReducedMotion';
export function useAnimatedNumber(value:number,{duration=280,initial=false,delay=0}:{duration?:number;initial?:boolean;delay?:number}={}){
  const reduced=useReducedMotion(),[display,set]=useState(value),[flash,setFlash]=useState(false),previous=useRef(display),mounted=useRef(false);
  useEffect(()=>{const changed=mounted.current&&previous.current!==value;mounted.current=true;
    if(reduced||previous.current===value){previous.current=value;set(value);return;}
    let frame=0,timer=0;const from=previous.current,start=performance.now()+(initial&&!changed?delay:0);
    if(changed){setFlash(true);timer=window.setTimeout(()=>setFlash(false),500);}
    const tick=(now:number)=>{const p=Math.min(1,Math.max(0,(now-start)/duration));set(from+(value-from)*(1-(1-p)**3));if(p<1)frame=requestAnimationFrame(tick);else previous.current=value;};
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
  },[value,reduced,duration,initial,delay]);return {display:reduced?value:display,flash};
}
