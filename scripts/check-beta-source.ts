import {readFile,writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {queryMcp} from '../api/_bitget.js';
import {nyDate} from '../engine/calendar.js';
import type {DailyBar} from '../engine/types.js';
const history=JSON.parse(await readFile('raw/bitget/daily-history.json','utf8')) as {bars:Record<string,DailyBar[]>};
const schema=z.object({data:z.object({provider:z.string(),results:z.array(z.object({date:z.string(),open:z.number(),close:z.number()}))})});
const checks=await Promise.allSettled(['AAPL','MSFT','QQQ'].map(async symbol=>{
 const raw=await queryMcp('equity_price_historical',{symbol,start_date:'2025-09-22',end_date:'2026-09-21'},25000);
 await writeFile('raw/bitget/'+symbol+'-source-check.json',JSON.stringify(raw));
 const parsed=schema.parse(raw),saved=new Map(history.bars['r'+symbol]!.map(b=>[b.date,b]));
 const mismatches=parsed.data.results.filter(b=>{const old=saved.get(nyDate(Date.parse(b.date)));return !old||old.open!==b.open||old.close!==b.close||nyDate(Date.parse(b.date))!==b.date.slice(0,10);});
 console.log(JSON.stringify({symbol,provider:parsed.data.provider,rows:parsed.data.results.length,mismatches,firstTimestamp:parsed.data.results[0]?.date,lastTimestamp:parsed.data.results.at(-1)?.date}));
}));
for(const check of checks)if(check.status==='rejected'){console.error(String(check.reason));process.exitCode=1;}
