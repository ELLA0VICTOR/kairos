import {readFile} from 'node:fs/promises';
import {estimateParameters} from '../engine/params.js';
import {getSessionInfo,nyDate,previousClose} from '../engine/calendar.js';
import type {DailyBar,Instrument} from '../engine/types.js';
import type {RealMarket} from '../engine/artifacts.js';
import {realMarketBoard} from '../engine/real-market.js';
import {adaptQuotes} from '../src/data/providers/bitget-adapters.js';
import {bitgetRequest} from '../api/_bitget.js';
import {context,writeJson} from './pipeline-context.js';
// Deliberately separate from the synthetic pipeline and its immutable Record.
// Refresh the captured underlying history with audit:bitget before its anchor expires.
const c=context(),history=JSON.parse(await readFile('raw/bitget/daily-history.json','utf8')) as {universe:Instrument[];bars:Record<string,DailyBar[]>};
const audit=JSON.parse(await readFile('raw/bitget/audit.json','utf8')) as {asOf:string};
const now=Date.now(),anchorDate=nyDate(previousClose(now));
if(history.universe.some(i=>history.bars[i.symbol]?.at(-1)?.date!==anchorDate))throw new Error('Run audit:bitget first: completed official-close history is stale');
const estimates=estimateParameters(history.universe,history.bars,Date.parse(audit.asOf));
const quotes=adaptQuotes(await bitgetRequest({method:'quotes'}),history.universe.map(i=>i.symbol));
const bundle:RealMarket={anchorDate,anchors:Object.fromEntries(history.universe.map(i=>[i.symbol,history.bars[i.symbol]!.at(-1)!.close])),historyAsOf:Date.parse(audit.asOf),data:{source:'live',universe:history.universe,params:{...estimates,expectedVolumes:[],corporateActions:[]},analogs:[],snapshot:{ts:now,session:getSessionInfo(now),rows:[],news:[]},ledgerLive:[],ledgerBacktest:[]}};
const board=realMarketBoard(bundle,quotes.quotes,now);
bundle.data.snapshot={ts:board.ts,session:board.session,rows:board.rows,news:[]};
await writeJson(c,'public/data/real-market.json',bundle);
await writeJson(c,'raw/bitget/real-forecast-report.json',{asOf:new Date(now).toISOString(),anchorDate,source:'live',limitations:['Reversion buckets are cold-start defaults (kappa=0, sigmaForecast=0.03, nObs=0), not synthetic fits.','No real analog index or real resolved ledger yet.','Window volume and news impacts unavailable; conservative liquidity and news uncertainty floor apply.'],rows:board.rows.map(r=>({symbol:r.instrument.symbol,estimateStability:estimates.instruments[r.instrument.symbol]!.estimateStability,beta:estimates.instruments[r.instrument.symbol]!.beta,forecast:r.forecast,evidence:r.evidence}))});
console.log(JSON.stringify({asOf:new Date(now).toISOString(),anchorDate,quotes:quotes.quotes.length,stable:Object.values(estimates.instruments).filter(p=>p.estimateStability==='stable').map(p=>p.symbol),unstable:Object.values(estimates.instruments).filter(p=>p.estimateStability==='unstable').map(p=>p.symbol),forecasts:board.rows.filter(r=>r.forecast).length,note:'Real prices and daily-gap estimates; cold-start reversion, no real analogs. Synthetic Record untouched.'},null,2));
