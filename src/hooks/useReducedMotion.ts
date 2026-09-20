import { useEffect,useState } from 'react';
export function useReducedMotion(){const [value,set]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),fn=()=>set(m.matches);m.addEventListener('change',fn);return()=>m.removeEventListener('change',fn);},[]);return value;}
