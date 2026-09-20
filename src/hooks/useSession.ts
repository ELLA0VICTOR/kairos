import { useEffect,useState } from 'react';
import { getSessionInfo } from '@engine/calendar';
import { replayTs } from '@/data/queries';
export function useSession(){const [wallNow,set]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>set(Date.now()),1000);return()=>clearInterval(id);},[]);const now=replayTs??wallNow;return {now,wallNow,session:getSessionInfo(now)};}
