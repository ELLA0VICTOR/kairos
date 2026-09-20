import type { ArtifactSet } from '@engine/artifacts';
import type { Board } from '@engine/board';
let worker:Worker|undefined,lastData:ArtifactSet|undefined,sequence=0;
export function marketBoard(data:ArtifactSet,ts?:number):Promise<Board>{
 worker??=new Worker(new URL('./market.worker.ts',import.meta.url),{type:'module'});
 const active=worker,id=++sequence;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timeout);active.removeEventListener('message',receive);active.removeEventListener('error',failure);};
  const receive=(event:MessageEvent<{id:number;board?:Board;error?:string}>)=>{if(event.data.id!==id)return;cleanup();event.data.board?resolve(event.data.board):reject(new Error(event.data.error));};
  const failure=()=>{cleanup();reject(new Error('Market worker unavailable; showing last snapshot'));};
  const timeout=setTimeout(failure,15000);
  active.addEventListener('message',receive);active.addEventListener('error',failure);
  active.postMessage({id,ts,data:lastData===data?undefined:{...data,ledgerBacktest:[],ledgerLive:[]}});lastData=data;
 });
}
