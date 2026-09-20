import { useLayoutEffect,useRef,useState } from 'react';
export function useResizeObserver(){const ref=useRef<HTMLDivElement>(null),[width,set]=useState(600);useLayoutEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(entries=>set(Math.max(1,entries[0]!.contentRect.width)));observer.observe(ref.current);return()=>observer.disconnect();},[]);return {ref,width};}
