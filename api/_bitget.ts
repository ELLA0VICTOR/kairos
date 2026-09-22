import {z} from 'zod';
import {SYMBOL_MAP} from '../src/data/providers/symbolMap.js';
const rpcEnvelope=z.object({result:z.unknown().optional(),error:z.unknown().optional()});
let rpcId=0;
export async function queryMcp(entry:string,params:Record<string,unknown>,timeoutMs=8000):Promise<unknown>{
 const endpoint=process.env.BITGET_MCP_URL??'https://agent.bitget.com/mcp';let session:string|undefined;
 async function rpc(method:string,input:unknown){
  const id=++rpcId,response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id,method,params:input}),signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw new Error('Bitget MCP HTTP '+response.status);session=response.headers.get('mcp-session-id')??session;
  const text=await response.text();if(text.length>8_000_000)throw new Error('MCP response too large');
  const raw=response.headers.get('content-type')?.includes('text/event-stream')?text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>JSON.parse(line.slice(5)) as {id?:number}).find(row=>row.id===id):JSON.parse(text) as unknown;
  const body=rpcEnvelope.parse(raw);if(body.error)throw new Error('MCP query failed');return body.result;
 }
 await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'kairos-read-only',version:'1.0.0'}});
 const initialized=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(timeoutMs)});
 if(!initialized.ok)throw new Error('MCP initialization failed');await initialized.body?.cancel();
 const result=z.object({isError:z.boolean().optional(),structuredContent:z.unknown().optional(),content:z.array(z.object({type:z.string(),text:z.string().optional()})).optional()}).parse(await rpc('tools/call',{name:'do_query',arguments:{entry_id:entry,params}}));
 if(result.isError)throw new Error('Bitget query rejected');
 if(result.structuredContent!==undefined)return result.structuredContent;
 const text=result.content?.find(row=>row.type==='text')?.text;if(!text)throw new Error('Missing MCP result');return JSON.parse(text) as unknown;
}
export type MarketRequest={method:'quotes'|'candles'|'daily'|'news';symbol?:string;fromTs?:number;interval?:5|15|60;days?:number};
const cache=new Map<string,{ts:number;value:unknown}>(),pending=new Map<string,Promise<unknown>>();
export async function bitgetRequest(request:MarketRequest):Promise<unknown>{
 const key=JSON.stringify(request),saved=cache.get(key),ttl=request.method==='quotes'?20000:request.method==='daily'?3600000:60000;
 if(saved&&Date.now()-saved.ts<ttl)return saved.value;
 if(pending.has(key))return pending.get(key)!;
 const promise=(async()=>{
  let value:unknown;
  if(request.method==='daily'){
   if(!Object.values(SYMBOL_MAP).some(row=>row.underlying===request.symbol))throw new Error('Unsupported underlying');
   // Keep the requested calendar span below the observed 1,000-row upstream
   // cap; a 1,500-day query silently stopped in August despite a September end.
   const end=new Date(),start=new Date(end.getTime()-(Math.ceil((request.days??750)*1.6)+30)*86400000);
   value=await queryMcp('equity_price_historical',{symbol:request.symbol,start_date:start.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10)});
  }else if(request.method==='news')value=await queryMcp('news_label_search',{label:'stocks',language_id:'en',page_size:50});
  else{
   const url=new URL('https://api.bitget.com/api/v3/market/'+(request.method==='quotes'?'tickers':'candles'));url.searchParams.set('category','SPOT');
   if(request.method==='candles'){
    const mapping=SYMBOL_MAP[request.symbol??''];if(!mapping)throw new Error('Unsupported symbol');
    url.searchParams.set('symbol',mapping.spot);url.searchParams.set('interval',request.interval===60?'1H':`${request.interval??60}m`);url.searchParams.set('type','market');url.searchParams.set('limit','1000');url.searchParams.set('startTime',String(request.fromTs));
   }
   const response=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw new Error('Bitget HTTP '+response.status);value=await response.json();
  }
  // Cache successful envelopes only, not provider errors transported in HTTP 200.
  const ok=z.union([z.object({code:z.literal('00000')}),z.object({success:z.literal(true),status_code:z.literal(200)})]).safeParse(value);
  if(!ok.success)throw new Error('Bitget returned no usable data');
  if(cache.size>100)cache.delete(cache.keys().next().value!);cache.set(key,{ts:Date.now(),value});return value;
 })();pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
}
