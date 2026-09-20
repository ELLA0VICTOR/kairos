import { useEffect,useState } from 'react';
import type { ArtifactSet } from '@engine/artifacts';
import type { Board } from '@engine/board';
import type { Reckoning } from '@engine/types';
export function useHistory(data:ArtifactSet,board:Board,symbol:string){
 const [result,set]=useState<{symbol:string;points:Reckoning[];error?:string}|null>(null);
 useEffect(()=>{const worker=new Worker(new URL('../data/history.worker.ts',import.meta.url),{type:'module'});set(null);worker.onmessage=e=>set({symbol,...e.data});worker.onerror=()=>set({symbol,points:[],error:'Window history calculation failed.'});worker.postMessage({data:{...data,analogs:[],ledgerLive:[],ledgerBacktest:[]},board,symbol});return()=>worker.terminate();},[data,board,symbol]);
 return result?.symbol===symbol?result:null;
}
