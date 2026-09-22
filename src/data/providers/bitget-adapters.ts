import {z} from 'zod';
import type {Candle,DailyBar,NewsItem,Quote} from '../../../engine/types.js';
import {CANONICAL_BY_SPOT} from './symbolMap.js';
import {ProviderError} from './types.js';
const numeric=z.union([z.number(),z.string().trim().min(1)]).transform(Number).pipe(z.number().finite());
const positive=numeric.pipe(z.number().positive());
const nonnegative=numeric.pipe(z.number().nonnegative());
const timestamp=positive.pipe(z.number().int());
const optionalPrice=z.union([positive,z.literal(''),z.literal('0'),z.literal(0),z.null()]).optional();
const optionalVolume=z.union([nonnegative,z.literal(''),z.null()]).optional();
function validated<T>(method:string,parse:()=>T):T{try{return parse();}catch(error){throw new ProviderError('bitget',method,'Invalid Bitget '+method+' response',error);}}
const rest=z.object({code:z.literal('00000'),requestTime:timestamp,data:z.array(z.unknown())});
const mcp=z.object({success:z.literal(true),status_code:z.literal(200),data:z.object({results:z.array(z.unknown())})});
export function adaptQuotes(raw:unknown,requested:string[]):{asOf:number;quotes:Quote[]}{return validated('getQuotes',()=>{
 const envelope=rest.parse(raw),wanted=new Set(requested);
 const schema=z.object({symbol:z.string(),lastPrice:positive,bid1Price:optionalPrice,ask1Price:optionalPrice,ts:timestamp,platformTurnover24h:optionalVolume});
 const quotes:Quote[]=[];
 for(const item of envelope.data){const id=z.object({symbol:z.string()}).parse(item).symbol,symbol=CANONICAL_BY_SPOT[id];if(!symbol||!wanted.has(symbol))continue;
  const row=schema.parse(item);let bid=typeof row.bid1Price==='number'&&row.bid1Price>0?row.bid1Price:null,ask=typeof row.ask1Price==='number'&&row.ask1Price>0?row.ask1Price:null;
  if(bid!==null&&ask!==null&&bid>ask){bid=null;ask=null;}
  // Platform turnover is USDT. General turnover may include external liquidity.
  quotes.push({symbol,price:row.lastPrice,bid,ask,ts:row.ts,volume24h:typeof row.platformTurnover24h==='number'?row.platformTurnover24h:null,volumeSinceClose:null});
 }
 if(!quotes.length)throw new Error('No requested rToken quotes');
 return {asOf:envelope.requestTime,quotes};
});}
export function adaptCandles(raw:unknown):Candle[]{return validated('getWindowCandles',()=>{
 const envelope=rest.parse(raw),schema=z.tuple([timestamp,positive,positive,positive,positive,nonnegative,nonnegative]);
 return envelope.data.map(item=>{const [ts,open,high,low,close,,volume]=schema.parse(item);if(low>Math.min(open,close)||high<Math.max(open,close)||low>high)throw new Error('Invalid candle range');return {ts,open,high,low,close,volume};}).sort((a,b)=>a.ts-b.ts);
});}
export function adaptDailyBars(raw:unknown,underlying:string):DailyBar[]{return validated('getDailyBars',()=>{
 const schema=z.object({symbol:z.literal(underlying),date:z.string().datetime({offset:true}),open:positive,high:positive,low:positive,close:positive,volume:nonnegative});
 const rows=mcp.parse(raw).data.results.map(item=>schema.parse(item)).sort((a,b)=>a.date.localeCompare(b.date));
 const seen=new Set<string>();
 return rows.map((row,index)=>{const date=row.date.slice(0,10);if(seen.has(date)||row.low>Math.min(row.open,row.close)||row.high<Math.max(row.open,row.close))throw new Error('Invalid daily bars');seen.add(date);return {date,open:row.open,high:row.high,low:row.low,close:row.close,volume:row.volume,gapLogReturn:index?Math.log(row.open/rows[index-1]!.close):null};});
});}
export function adaptNews(raw:unknown,sinceTs:number):NewsItem[]{return validated('getNews',()=>{
 const schema=z.object({title:z.string().min(1),published_at:z.string().datetime({offset:true})});
 return mcp.parse(raw).data.results.map(item=>schema.parse(item)).map(row=>({id:'bitget:'+row.published_at+':'+row.title,ts:Date.parse(row.published_at),headline:row.title,source:'Bitget',url:null,symbols:[],category:'other' as const,impact:null,impactConfidence:null,preAnchor:false})).filter(row=>row.ts>=sinceTs);
});}
