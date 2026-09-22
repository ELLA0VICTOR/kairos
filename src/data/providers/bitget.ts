import type {Instrument} from '../../../engine/types.js';
import {SYMBOL_MAP} from './symbolMap.js';
import {adaptCandles,adaptDailyBars,adaptNews,adaptQuotes} from './bitget-adapters.js';
import {ProviderError,type MarketDataProvider,type ProviderHealth} from './types.js';
import {nyDate,previousClose} from '../../../engine/calendar.js';
export type BitgetRequest={method:'quotes'|'candles'|'daily'|'news';symbol?:string;fromTs?:number;interval?:5|15|60;days?:number};
export type BitgetTransport=(request:BitgetRequest)=>Promise<unknown>;
async function browserTransport(request:BitgetRequest):Promise<unknown>{
 const query=new URLSearchParams(Object.entries(request).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]));
 const response=await fetch((request.method==='quotes'?'/api/quotes?raw=1&':'/api/market?')+query,{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Market endpoint unavailable');
 const data=await response.json() as {available?:boolean;raw?:unknown};if(!data.available)throw new Error('Live source unavailable');return data.raw;
}
export class BitgetProvider implements MarketDataProvider{
 readonly id='bitget' as const;
 private status:ProviderHealth={id:'bitget',ok:false,lastSuccessTs:null,lastErrorTs:null,lastError:null,methods:{}};
 constructor(private readonly universe:Instrument[],private readonly transport:BitgetTransport=browserTransport){}
 health():ProviderHealth{return structuredClone(this.status);}
 private async run<T>(method:keyof NonNullable<ProviderHealth['methods']>,action:()=>Promise<T>):Promise<T>{
  try{const result=await action(),now=Date.now();this.status.lastSuccessTs=now;this.status.methods![method]={ok:true,source:'bitget',lastSuccessTs:now,lastErrorTs:null,lastError:null};const failures=Object.values(this.status.methods!).filter(row=>!row.ok);this.status.ok=failures.length===0;this.status.lastError=failures.map(row=>row.lastError).join('; ')||null;return result;}
  catch(error){const now=Date.now();this.status.ok=false;this.status.lastErrorTs=now;this.status.lastError='Bitget '+method+' unavailable';this.status.methods![method]={ok:false,source:'bitget',lastSuccessTs:this.status.methods![method]?.lastSuccessTs??null,lastErrorTs:now,lastError:this.status.lastError};throw error instanceof ProviderError?error:new ProviderError('bitget',method,this.status.lastError,error);}
 }
 async isAvailable(){try{await this.getQuotes(['rSPY','rQQQ']);return true;}catch{return false;}}
 getUniverse(){return this.run('getUniverse',async()=>this.universe.filter(row=>!!SYMBOL_MAP[row.symbol]));}
 getQuotes(symbols:string[]){return this.run('getQuotes',async()=>adaptQuotes(await this.transport({method:'quotes'}),symbols));}
 getWindowCandles(symbol:string,fromTs:number,intervalMinutes:5|15|60){return this.run('getWindowCandles',async()=>adaptCandles(await this.transport({method:'candles',symbol,fromTs,interval:intervalMinutes})).filter(row=>row.ts>=fromTs));}
 getDailyBars(underlying:string,days:number){return this.run('getDailyBars',async()=>{const latestClose=nyDate(previousClose(Date.now()));const bars=adaptDailyBars(await this.transport({method:'daily',symbol:underlying,days}),underlying).filter(row=>row.date<=latestClose);if(!bars.length)throw new Error('No completed daily bars');if(bars.at(-1)!.date!==latestClose)throw new Error('Official close history is not current');return bars.slice(-days);});}
 getNews(sinceTs:number,_symbols?:string[]){return this.run('getNews',async()=>adaptNews(await this.transport({method:'news'}),sinceTs));}
}
