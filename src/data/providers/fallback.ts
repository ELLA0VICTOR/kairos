import type {MarketDataProvider,ProviderHealth} from './types.js';
type Method=keyof NonNullable<ProviderHealth['methods']>;
/** Per-method cooldown: unrelated feeds remain usable while a failed one retries after 60s. */
export class FallbackProvider implements MarketDataProvider{
 readonly id='bitget' as const;
 private retryAt=new Map<Method,number>();
 private methods:NonNullable<ProviderHealth['methods']>={};
 constructor(private readonly live:MarketDataProvider,private readonly fallback:MarketDataProvider,private readonly now=Date.now,private readonly changed:()=>void=()=>{}){}
 private async call<T>(method:Method,real:()=>Promise<T>,simulated:()=>Promise<T>):Promise<T>{
  const ts=this.now();
  if(ts>=(this.retryAt.get(method)??0)){
   try{const value=await real();this.retryAt.delete(method);this.methods[method]={ok:true,source:'bitget',lastSuccessTs:ts,lastErrorTs:null,lastError:null};this.changed();return value;}
   catch{this.retryAt.set(method,ts+60000);this.methods[method]={ok:false,source:'synthetic',lastSuccessTs:this.methods[method]?.lastSuccessTs??null,lastErrorTs:ts,lastError:'Live '+method+' unavailable; simulated fallback'};this.changed();}
  }
  return simulated();
 }
 health():ProviderHealth{const rows=Object.values(this.methods),errors=rows.filter(row=>!row.ok);return {id:'bitget',ok:rows.length>0&&!errors.length,lastSuccessTs:Math.max(...rows.map(r=>r.lastSuccessTs??0),0)||null,lastErrorTs:Math.max(...rows.map(r=>r.lastErrorTs??0),0)||null,lastError:errors.map(r=>r.lastError).join('; ')||null,methods:structuredClone(this.methods)};}
 async isAvailable(){try{await this.getQuotes(['rSPY','rQQQ']);return this.methods.getQuotes?.source==='bitget';}catch{return false;}}
 getUniverse(){return this.call('getUniverse',()=>this.live.getUniverse(),()=>this.fallback.getUniverse());}
 getQuotes(symbols:string[]){return this.call('getQuotes',()=>this.live.getQuotes(symbols),()=>this.fallback.getQuotes(symbols));}
 getWindowCandles(symbol:string,from:number,interval:5|15|60){return this.call('getWindowCandles',()=>this.live.getWindowCandles(symbol,from,interval),()=>this.fallback.getWindowCandles(symbol,from,interval));}
 getDailyBars(symbol:string,days:number){return this.call('getDailyBars',()=>this.live.getDailyBars(symbol,days),()=>this.fallback.getDailyBars(symbol,days));}
 getNews(since:number,symbols?:string[]){return this.call('getNews',()=>this.live.getNews(since,symbols),()=>this.fallback.getNews(since,symbols));}
}
