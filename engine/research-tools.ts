import { findAnalogs } from './analogs';
import { explainedShare } from './attribute';
import { HOUR } from './calendar';
import { rankedRows,recordStats,type EngineSnapshot,type FigureRef,type ParsedIntent } from './research';
const symbol={type:'string',description:'A covered canonical rToken symbol'};
const limit={type:'integer',minimum:1,maximum:80};
const spec=(name:string,description:string,properties:Record<string,unknown>,required:string[]=[])=>({name,description,parameters:{type:'object',properties,required,additionalProperties:false}});
export const TOOLS=[
  spec('get_session','Current session, whether exchange is dark, and time to next open.',{}),
  spec('get_board','All covered instruments with price, reckoning, drift, trust and explained share. Call first for questions not about a single instrument.',{sortBy:{type:'string',enum:['drift','trust','explained']},limit}),
  spec('get_reckoning','Full reckoning, band, trust and liquidity reasons.',{symbol},['symbol']),
  spec('get_attribution','Market, sector, news and unaccounted move, including news drivers.',{symbol},['symbol']),
  spec('get_forecast','Opening gap forecast, interval and evidence count.',{symbol},['symbol']),
  spec('get_analogs','Comparable historical windows and their opening outcomes.',{symbol,limit},['symbol']),
  spec('get_news','News since the official close with impacts.',{symbols:{type:'array',items:symbol},limit}),
  spec('get_track_record','Accuracy, coverage and skill; separate live and backtest, cut by trust and sector.',{origin:{type:'string',enum:['live','backtest','both']},trust:{type:'string',enum:['thin','moderate','deep','all']}}),
];
export type ToolName=typeof TOOLS[number]['name'];
export interface ResearchCall {name:string;args:Record<string,unknown>}
export function runTool(call:ResearchCall,data:EngineSnapshot):unknown {
  const spec=TOOLS.find(t=>t.name===call.name);if(!spec)throw new Error('Unknown research tool');
  const a=call.args;
  if(Object.keys(a).some(k=>!(k in spec.parameters.properties)))throw new Error('Unknown tool argument');
  if(a.limit!==undefined&&(!Number.isInteger(a.limit)||Number(a.limit)<1||Number(a.limit)>80))throw new Error('Invalid limit');
  const n=Number(a.limit??20),s=data.snapshot;
  if(call.name==='get_session')return {...s.session,asOf:s.ts,timeToOpenMs:Math.max(0,s.session.nextOpenTs-s.ts)};
  if(call.name==='get_board'){
    if(a.sortBy!==undefined&&!['drift','trust','explained'].includes(String(a.sortBy)))throw new Error('Invalid sort');
    return rankedRows(data).sort((x,y)=>a.sortBy==='trust'?y.reckoning.trust-x.reckoning.trust:a.sortBy==='explained'?explainedShare(y.reckoning.components)-explainedShare(x.reckoning.components):Math.abs(y.reckoning.drift)-Math.abs(x.reckoning.drift)).slice(0,n).map(r=>({...r.reckoning,explained:explainedShare(r.reckoning.components),stale:r.stale}));
  }
  if(call.name==='get_track_record'){
    const origin=a.origin??'both',trust=a.trust??'all';
    if(!['live','backtest','both'].includes(String(origin))||!['thin','moderate','deep','all'].includes(String(trust)))throw new Error('Invalid ledger filter');
    return {live:origin!=='backtest'?recordStats(data,'live',String(trust)):null,backtest:origin!=='live'?recordStats(data,'backtest',String(trust)):null,notice:'Synthetic data. Ledgers are separate; no real-market validation.'};
  }
  if(call.name==='get_news'){
    if(a.symbols!==undefined&&(!Array.isArray(a.symbols)||a.symbols.some(v=>typeof v!=='string'||!data.universe.some(i=>i.symbol===v))))throw new Error('Invalid news symbols');
    const symbols=a.symbols as string[]|undefined;
    return s.news.filter(item=>item.ts>=s.session.anchorCloseTs&&item.ts<=s.ts&&!item.preAnchor&&(!symbols?.length||!item.symbols.length||item.symbols.some(v=>symbols.includes(v)))).slice(0,n);
  }
  const row=s.rows.find(r=>r.instrument.symbol===a.symbol);
  if(!row)throw new Error('Unknown or missing instrument');
  switch(call.name){
    case 'get_reckoning':return {...row.reckoning,reasons:row.liquidity.reasons,stale:row.stale};
    case 'get_attribution':return {...row.reckoning.components,explained:explainedShare(row.reckoning.components)};
    case 'get_forecast':return {forecast:row.forecast,evidence:row.evidence};
    case 'get_analogs': {
      const r=row.reckoning;
      return findAnalogs({absDrift:Math.abs(r.drift),drift:r.drift,explainedShare:explainedShare(r.components),trust:r.trust,windowType:s.session.state==='holiday'?'holiday':s.session.windowDurationMs>30*HOUR?'weekend':'overnight',sectorKey:row.instrument.sector,windowProgress:s.session.windowProgress,realisedVolRegime:1,newsCategory:s.news.find(v=>v.impact&&v.symbols.includes(r.symbol))?.category??null},data.analogs,n);
    }
    default:throw new Error('Unknown research tool');
  }
}
export function researchPlan(intent:ParsedIntent,data:EngineSnapshot):ResearchCall[]{
  if(intent.unsupported.length)return [{name:'get_session',args:{}}];
  const primary=intent.symbols[0]??rankedRows(data)[0]?.instrument.symbol;
  if(!primary)return [{name:'get_session',args:{}}];
  const row=data.snapshot.rows.find(r=>r.instrument.symbol===primary);
  if(intent.kind==='compare'){
    const other=intent.symbols[1]??rankedRows(data).find(r=>r.instrument.symbol!==primary)?.instrument.symbol;
    return [{name:'get_board',args:{sortBy:'drift'}},{name:'get_session',args:{}},...([primary,other].filter((v):v is string=>!!v).flatMap(symbol=>[{name:'get_attribution',args:{symbol}},{name:'get_forecast',args:{symbol}}]))];
  }
  if(intent.kind==='trust_the_model')return [{name:'get_board',args:{sortBy:'trust'}},{name:'get_track_record',args:{origin:'both',trust:row?.reckoning.trustLabel??'all'}},{name:'get_reckoning',args:{symbol:primary}},{name:'get_attribution',args:{symbol:primary}},{name:'get_forecast',args:{symbol:primary}},{name:'get_session',args:{}}];
  return [{name:intent.kind==='scan_board'?'get_board':'get_reckoning',args:intent.kind==='scan_board'?{sortBy:'drift'}:{symbol:primary}},{name:'get_attribution',args:{symbol:primary}},{name:'get_analogs',args:{symbol:primary,limit:80}},{name:'get_news',args:{symbols:[primary]}},{name:'get_forecast',args:{symbol:primary}},{name:'get_session',args:{}}];
}
export function figureWasRetrieved(ref:FigureRef,calls:ResearchCall[],data:EngineSnapshot):boolean {
  if(ref.kind==='sizeCeiling')return true;
  if(ref.kind==='nextOpen')return calls.some(c=>c.name==='get_session');
  if(['coverage','skill','recordCount'].includes(ref.kind))return calls.some(c=>c.name==='get_track_record'&&(c.args.origin===undefined||c.args.origin==='both'||c.args.origin===ref.origin)&&(c.args.trust??'all')===(ref.trust??'all'));
  const names=['forecastMedian','forecastLow','forecastHigh','analogCount'].includes(ref.kind)?['get_forecast']:ref.kind==='explained'?['get_attribution','get_board']:['get_reckoning','get_board'];
  return calls.some(c=>names.includes(c.name)&&(c.name==='get_board'?(runTool(c,data) as Array<{symbol:string}>).some(row=>row.symbol===ref.symbol):c.args.symbol===ref.symbol));
}
