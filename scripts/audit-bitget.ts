import {mkdir,writeFile} from 'node:fs/promises';
import {BitgetProvider} from '../src/data/providers/bitget.js';
import {bitgetRequest} from '../api/_bitget.js';
import {UNIVERSE} from '../src/data/providers/anchors';
import {nyDate,regularClose,isTradingDate} from '../engine/calendar.js';
import {estimateParameters} from '../engine/params.js';
import type {DailyBar} from '../engine/types.js';
const provider=new BitgetProvider(UNIVERSE,bitgetRequest),bars:Record<string,DailyBar[]>={};
await mkdir('raw/bitget',{recursive:true});
const quotes=await provider.getQuotes(UNIVERSE.map(i=>i.symbol));
await writeFile('raw/bitget/quotes.json',JSON.stringify(quotes));console.log(`Live quotes: ${quotes.quotes.length}/${UNIVERSE.length}`);
for(let i=0;i<UNIVERSE.length;i+=2){
 await Promise.all(UNIVERSE.slice(i,i+2).map(async instrument=>{
  const daily=await provider.getDailyBars(instrument.underlying,750);
  bars[instrument.symbol]=daily.filter(b=>isTradingDate(b.date)&&regularClose(new Date(b.date+'T16:00:00Z')).getTime()<=Date.now());
  await writeFile('raw/bitget/'+instrument.underlying+'-daily.json',JSON.stringify(bars[instrument.symbol]));
  console.log(`${instrument.symbol}: ${bars[instrument.symbol]!.length} completed daily bars`);
 }));
}
const estimates=estimateParameters(UNIVERSE,bars,Date.now(),[]);
const audit={asOf:new Date().toISOString(),date:nyDate(Date.now()),source:'live',quotes:quotes.quotes.length,instruments:Object.fromEntries(Object.entries(estimates.instruments).map(([symbol,p])=>[symbol,{beta:p.beta,nObs:p.nObs,betaStdErr:p.betaStdErr}])),note:'Daily-gap beta audit only. No real reversion buckets, analogs or backtest are implied; production synthetic artifacts are unchanged.'};
await writeFile('raw/bitget/daily-history.json',JSON.stringify({universe:UNIVERSE,bars}));
await writeFile('raw/bitget/audit.json',JSON.stringify(audit,null,2));console.log(JSON.stringify(audit,null,2));
