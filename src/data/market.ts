import type { ArtifactSet,RealMarket } from '@engine/artifacts';
import type { Board } from '@engine/board';
export async function liveMarket():Promise<{board:Board;data:ArtifactSet}>{
 const [{realMarketBoard},{adaptQuotes}]=await Promise.all([import('@engine/real-market'),import('./providers/bitget-adapters')]);
 const responses=await Promise.all(['/data/real-market.json','/api/quotes?raw=1'].map(url=>fetch(url,{signal:AbortSignal.timeout(10000)})));
 if(responses.some(r=>!r.ok))throw new Error('Real market bundle unavailable');
 const bundle=await responses[0]!.json() as RealMarket,raw=await responses[1]!.json() as {available:boolean;raw:unknown};
 if(!raw.available)throw new Error('Live quotes unavailable');
 const quotes=adaptQuotes(raw.raw,bundle.data.universe.map(i=>i.symbol));
 const board=realMarketBoard(bundle,quotes.quotes,Date.now());
 return {board,data:{...bundle.data,snapshot:{ts:board.ts,session:board.session,rows:board.rows,news:board.news}}};
}
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
