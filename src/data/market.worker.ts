import { computeBoard } from '@engine/board';
import { getSessionInfo } from '@engine/calendar';
import {unpackAnalogs,type ArtifactSet} from '@engine/artifacts';
import { getProvider } from './providers';
let data:ArtifactSet|undefined;
self.onmessage=async(event:MessageEvent<{id:number;data?:ArtifactSet;ts?:number}>)=>{
 const {id,ts}=event.data;
 if(event.data.data){data=event.data.data;if(data.compactAnalogs){data.analogs=unpackAnalogs(data.compactAnalogs);delete data.compactAnalogs;}}
 try{
  if(!data)throw new Error('Worker has no artifact set');
  const p=getProvider(ts),universe=data.universe,quotes=await p.getQuotes(universe.map(i=>i.symbol)),session=getSessionInfo(quotes.asOf);
  const [news,bars,candles]=await Promise.all([p.getNews(session.anchorCloseTs),Promise.all(universe.map(async i=>[i.symbol,(await p.getDailyBars(i.underlying,1))[0]?.close] as const)),Promise.all(universe.map(async i=>[i.symbol,await p.getWindowCandles(i.symbol,session.anchorCloseTs,60)] as const))]);
  const anchors=Object.fromEntries(bars.filter((entry):entry is readonly [string,number]=>typeof entry[1]==='number'));
  self.postMessage({id,board:computeBoard(data,{ts:quotes.asOf,quotes:quotes.quotes,anchors,news,candles:Object.fromEntries(candles)})});
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'Market calculation unavailable'});}
};
