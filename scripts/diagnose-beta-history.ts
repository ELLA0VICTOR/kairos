import {readFile,writeFile} from 'node:fs/promises';
import type {DailyBar} from '../engine/types.js';
import {atNy,nyDate,previousClose,regularClose,shiftDate,isTradingDate} from '../engine/calendar.js';
import {ols} from '../engine/stats.js';
const history=JSON.parse(await readFile('raw/bitget/daily-history.json','utf8')) as {bars:Record<string,DailyBar[]>};
const dividends:Record<string,Record<string,number>>={rAAPL:{'2025-11-10':.26,'2026-02-09':.26,'2026-05-11':.27,'2026-08-10':.27},rMSFT:{'2025-11-20':.91,'2026-02-19':.91,'2026-05-21':.91,'2026-08-20':.91}};
function pairs(symbol:string){const bars=history.bars[symbol]!;return new Map(bars.slice(1).map((b,i)=>[b.date,{date:b.date,previousDate:bars[i]!.date,close:bars[i]!.close,open:b.open,gap:Math.log(b.open/bars[i]!.close)}]));}
const factor=pairs('rQQQ');
const reports=['rAAPL','rMSFT','rNFLX'].map(symbol=>{
 const own=pairs(symbol),dates=[...own.keys()].filter(d=>factor.has(d)).sort().slice(-250);
 const rows=dates.map(date=>{
  const y=own.get(date)!,x=factor.get(date)!,expectedPreviousDate=nyDate(previousClose(atNy(date,'09:30')-1));
  const closeTs=regularClose(new Date(atNy(y.previousDate,'12:00'))).getTime();
  const skippedWeekdays:string[]=[];
  for(let day=shiftDate(y.previousDate,1);day<date;day=shiftDate(day,1)){const dow=new Date(day+'T12:00Z').getUTCDay();if(dow!==0&&dow!==6)skippedWeekdays.push(day);}
  return {date,underlying:y,qqq:x,expectedPreviousDate,aligned:y.previousDate===x.previousDate&&y.previousDate===expectedPreviousDate,isSession:isTradingDate(date),previousCloseUtc:new Date(closeTs).toISOString(),openUtc:new Date(atNy(date,'09:30')).toISOString(),previousHalfDay:closeTs===atNy(y.previousDate,'13:00'),currentHalfDay:regularClose(new Date(atNy(date,'12:00'))).getTime()===atNy(date,'13:00'),holidayAdjacent:skippedWeekdays,dividend:dividends[symbol]?.[date]??0};
 });
 function fit(part:typeof rows,addDividend=false){const result=ols(part.map(r=>r.qqq.gap),part.map(r=>addDividend?Math.log((r.underlying.open+r.dividend)/r.underlying.close):r.underlying.gap));return {n:part.length,beta:result.slope,se:result.slopeStdErr,t:result.slope/result.slopeStdErr};}
 const halves=[rows.slice(0,125),rows.slice(125)];
 return {symbol,full:fit(rows),halves:halves.map(part=>fit(part)),dividendSensitivity:{full:fit(rows,true),halves:halves.map(part=>fit(part,true))},alignmentFailures:rows.filter(r=>!r.aligned||!r.isSession),outliers:halves.map(part=>[...part].sort((a,b)=>Math.abs(b.underlying.gap)-Math.abs(a.underlying.gap)).slice(0,10)),dividendRows:rows.filter(r=>r.dividend)};
});
await writeFile('raw/bitget/beta-root-cause.json',JSON.stringify(reports,null,2));
for(const r of reports){console.log(JSON.stringify({symbol:r.symbol,full:r.full,halves:r.halves,dividendSensitivity:r.dividendSensitivity,alignmentFailures:r.alignmentFailures}));for(let h=0;h<2;h++){console.log(r.symbol+' H'+(h+1));for(const row of r.outliers[h]!)console.log(JSON.stringify(row));}}
