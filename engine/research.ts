import type { ArtifactSet, SnapshotRow } from './artifacts';
import { explainedShare } from './attribute';
import { computeStats } from './score';
import { trustLabel } from './liquidity';

export type IntentKind='single_name'|'compare'|'scan_board'|'risk_of_holding'|'trust_the_model';
export interface ParsedIntent {kind:IntentKind;symbols:string[];unsupported:string[];portfolioShared:boolean}
export type EngineSnapshot=ArtifactSet;
export const FIGURE_KINDS=['price','reckonedValue','bandLow','bandHigh','drift','trust','explained','forecastMedian','forecastLow','forecastHigh','analogCount','coverage','skill','recordCount','nextOpen','sizeCeiling'] as const;
export type FigureKind=typeof FIGURE_KINDS[number];
export interface FigureRef {name:string;kind:FigureKind;symbol?:string;origin?:'live'|'backtest';trust?:'thin'|'moderate'|'deep'|'all'}
export interface EngineFigure extends FigureRef {value:number|null;format:'price'|'percent'|'logPercent'|'count'|'time';source:string}
export interface ResearchNote {
  title:string;paragraphs:string[];figures:FigureRef[];
  recommendation:{sizeCeilingPct:number;invalidatedIf:string;watchFor:string;resolvesAt:number};
  confidence:'low'|'moderate'|'high';confidenceReason:string;
}
export const FALLBACK_LABEL='Written without the model. The figures are unaffected — they come from the engine either way.';
export const RESEARCH_FOOTER='Kairos is analysis, not advice. Tokenized stocks carry risks that the underlying shares do not, including issuer, custody and liquidity risk. You can lose money.';
export function parseIntent(question:string,engine:EngineSnapshot):ParsedIntent {
  const symbols=engine.universe.filter(i=>!['rSPY','rQQQ'].includes(i.symbol)&&new RegExp(`\\b(?:${i.symbol}|${i.underlying})\\b`,'i').test(question)).map(i=>i.symbol);
  const known=new Set(engine.universe.flatMap(i=>[i.symbol.toUpperCase(),i.underlying]));
  const ignore=new Set(['I','AI','US','USD','USDT','ETF','ET','UTC','KAIROS','THE','IS','A','AND','OR','IF','MY','BUY','SELL','HOLD','WHY','WHAT','HOW','COMPARE','RISK','TRUST']);
  const tokens=question.match(/\$[A-Za-z][A-Za-z0-9.]*|\br[A-Z][A-Za-z0-9.]*\b|\b[A-Z]{2,6}\b/g)??[];
  const unsupported=[...new Set(tokens.map(s=>s.replace(/^\$/,'')).filter(s=>!known.has(s.toUpperCase())&&!ignore.has(s)))];
  const kind:IntentKind=/trust.*(model|kairos|forecast|estimate)|accurac|track record|calibrat|reliable/i.test(question)?'trust_the_model':/hold|holding|worst|downside|risk/i.test(question)?'risk_of_holding':symbols.length>1||/compar|versus|\bvs\b/i.test(question)?'compare':symbols.length===1?'single_name':'scan_board';
  return {kind,symbols,unsupported,portfolioShared:/\b(my portfolio|my account|i own|i hold|i have|holdings)\b/i.test(question)};
}
export function rankedRows(engine:EngineSnapshot):SnapshotRow[]{return engine.snapshot.rows.filter(r=>!['rSPY','rQQQ'].includes(r.instrument.symbol)&&!r.stale).sort((a,b)=>Math.abs(b.reckoning.drift)-Math.abs(a.reckoning.drift));}
export function recordStats(engine:EngineSnapshot,origin:'live'|'backtest',bucket='all'){
  const rows=(origin==='live'?engine.ledgerLive:engine.ledgerBacktest).filter(f=>bucket==='all'||trustLabel(f.trust)===bucket);
  return computeStats(rows,Object.fromEntries(engine.universe.map(i=>[i.symbol,i.sector])));
}
export function resolveFigure(ref:FigureRef,engine:EngineSnapshot):EngineFigure {
  const base={...ref,source:`Engine snapshot ${new Date(engine.snapshot.ts).toISOString()}`};
  if(ref.kind==='nextOpen')return {...base,value:engine.snapshot.session.nextOpenTs,format:'time'};
  // There is no validated allocation model or portfolio context. Never invent a nonzero ceiling.
  if(ref.kind==='sizeCeiling')return {...base,value:0,format:'percent',source:'Engine research policy: no justified allocation'};
  if(['coverage','skill','recordCount'].includes(ref.kind)){
    if(!ref.origin)throw new Error('A record figure must identify its ledger');
    const s=recordStats(engine,ref.origin,ref.trust);
    return {...base,value:ref.kind==='recordCount'?s.n:s.n?(ref.kind==='coverage'?s.bandCoverage:s.skillScore):null,format:ref.kind==='recordCount'?'count':'percent',source:`${ref.origin} ledger / ${ref.trust??'all'} trust`};
  }
  const row=engine.snapshot.rows.find(r=>r.instrument.symbol===ref.symbol);if(!row)throw new Error('Unknown figure instrument');
  const r=row.reckoning,f=row.forecast;
  switch(ref.kind){
    case 'price':return {...base,value:r.tokenPrice,format:'price'};
    case 'reckonedValue':case 'bandLow':case 'bandHigh':return {...base,value:r[ref.kind],format:'price'};
    case 'drift':return {...base,value:r.drift,format:'logPercent'};
    case 'trust':return {...base,value:r.trust,format:'percent'};
    case 'explained':return {...base,value:explainedShare(r.components),format:'percent'};
    case 'forecastMedian':case 'forecastLow':case 'forecastHigh':return {...base,value:f?(ref.kind==='forecastMedian'?f.median:ref.kind==='forecastLow'?f.p10:f.p90):null,format:'logPercent'};
    case 'analogCount':return {...base,value:f?.analogCount??null,format:'count'};
    default:throw new Error('Unsupported figure kind');
  }
}
export function stripInlineDigits(text:string):string {
  return text.split(/(\{\{fig:[A-Za-z][A-Za-z0-9_]*\}\})/g).map(part=>/^\{\{fig:/.test(part)?part:part.replace(/\p{N}+(?:[.,:]\p{N}+)*/gu,'[unverified figure removed]')).join('');
}
export function templateResearchNote(intent:ParsedIntent,engine:EngineSnapshot):ResearchNote {
  const rows=rankedRows(engine),requested=intent.symbols.map(s=>engine.snapshot.rows.find(r=>r.instrument.symbol===s)).filter((r):r is SnapshotRow=>!!r);
  const selected=requested.length?requested:rows.slice(0,intent.kind==='compare'?2:1);
  const row=selected[0],figures:FigureRef[]=[];
  const fig=(name:string,kind:FigureKind,symbol?:string,origin?:'live'|'backtest',trust?:FigureRef['trust'])=>{if(!figures.some(f=>f.name===name))figures.push({name,kind,symbol,origin,trust});return `{{fig:${name}}}`;};
  const title={single_name:'The evidence behind the move',compare:'Which dislocation deserves attention',scan_board:'Where the window is moving',risk_of_holding:'What carrying this through the bell means',trust_the_model:'What the record actually supports'}[intent.kind];
  const paragraphs:string[]=[];
  const condition=(r:SnapshotRow,prefix:string):string=>{
    const symbol=r.instrument.symbol,rc=r.reckoning,share=explainedShare(rc.components);
    const band=rc.tokenPrice>rc.bandHigh?'above':rc.tokenPrice<rc.bandLow?'below':'inside';
    return `${symbol} trades ${band} its reckoning band, with drift ${fig(prefix+'Drift','drift',symbol)}. `+
      (r.stale?'The quote is stale; this is a historical observation, not a current signal. ':!engine.snapshot.session.isDark?'External price discovery is active, so the dark-window forecast is paused. ':band==='inside'?'There is no clear dislocation beyond the current uncertainty band. ':`The token is ${band==='above'?'rich':'cheap'} relative to the model, but a dislocation is not proof of a reversal. `)+
      (rc.trustLabel==='thin'?'Thin liquidity weakens the information in this print. ':rc.trustLabel==='deep'?'Deeper liquidity gives the move more informational weight. ':'Liquidity is mixed; treat the print cautiously. ')+
      (share>=.6?'Observable market, sector and news factors explain most of the move. ':rc.trustLabel==='deep'?'Much of the move is unaccounted for despite meaningful liquidity. It may contain information the model cannot see. ':'Most of the move is unaccounted for; thin trading is a plausible explanation, not a proven cause. ')+
      (r.forecast?(r.forecast.analogCount>=30?'The analog set offers a comparison, not independent proof.':'The analog evidence is sparse; the model term does most of the work.'):'No usable opening forecast is available.');
  };
  if(intent.unsupported.length){paragraphs.push('Kairos only covers the supported equity rTokens. The requested instrument is outside that universe; no estimate has been made.');}
  else if(!row){paragraphs.push('No covered instrument has a usable quote in this snapshot. Wait for refreshed data before drawing a conclusion.');}
  else {
    const s=row.instrument.symbol,r=row.reckoning;
    switch(intent.kind){
      case 'single_name':paragraphs.push(`${s} trades at ${fig('price','price',s)} against a reckoned value of ${fig('reckoned','reckonedValue',s)}. The uncertainty band runs from ${fig('low','bandLow',s)} to ${fig('high','bandHigh',s)}.`,condition(row,'main'));break;
      case 'compare': {
        const other=selected[1]??rows.find(x=>x.instrument.symbol!==s);
        paragraphs.push(condition(row,'first'));
        if(other){paragraphs.push(condition(other,'second'));paragraphs.push(row.reckoning.trust>other.reckoning.trust?`${s} has the stronger liquidity support. That does not make it the better trade.`:row.reckoning.trust<other.reckoning.trust?`${other.instrument.symbol} has the stronger liquidity support. That does not make it the better trade.`:'Neither has a liquidity advantage in this snapshot. Compare the unexplained component rather than treating drift as an opportunity.');}
        else paragraphs.push('A comparable covered name is unavailable.');break;
      }
      case 'scan_board':paragraphs.push(`${s} has the widest absolute drift among the usable covered quotes. This scan ranks dislocation, not expected profit.`,condition(row,'main'));break;
      case 'risk_of_holding':paragraphs.push(condition(row,'main'),row.forecast?`The estimated opening gap spans ${fig('forecastLow','forecastLow',s)} to ${fig('forecastHigh','forecastHigh',s)}, with a midpoint of ${fig('forecastMedian','forecastMedian',s)}. This interval is not a worst-case loss limit; gaps can exceed it.`:'A gap interval is unavailable. The model cannot quantify the risk of carrying this through the next bell.');break;
      case 'trust_the_model': {
        const bucket=r.trustLabel,backtest=recordStats(engine,'backtest',bucket),live=recordStats(engine,'live',bucket);
        paragraphs.push(`For the ${bucket} liquidity bucket, backtest coverage is ${fig('coverage','coverage',undefined,'backtest',bucket)} across ${fig('backtestCount','recordCount',undefined,'backtest',bucket)} resolved fixes. Skill against the unchanged-price baseline is ${fig('skill','skill',undefined,'backtest',bucket)}.`);
        paragraphs.push(!backtest.n?'There are no resolved backtest fixes in this bucket.':backtest.skillScore<0?'In this bucket the model underperforms the unchanged-price baseline. Its forecast does not deserve an assumed edge.':'The backtest beats the unchanged-price baseline in this bucket. That is evidence within the sample, not proof of future performance.');
        paragraphs.push(live.n?`The separate forward ledger has ${fig('liveCount','recordCount',undefined,'live',bucket)} resolved fixes and coverage ${fig('liveCoverage','coverage',undefined,'live',bucket)}. Forward and backtest results are never pooled.`:'The forward ledger has no resolved fixes in this bucket. There is no forward validation to cite.');
        paragraphs.push(backtest.n&&backtest.bandCoverage<.8?'The backtest interval under-covers its nominal target. Do not read its boundaries as reliable loss limits.':'The coverage estimate depends on the available sample; it is not a guarantee.');paragraphs.push(condition(row,'main'));break;
      }
    }
    if(intent.kind!=='risk_of_holding'&&intent.kind!=='trust_the_model'&&row.forecast)paragraphs.push(`At the bell, the gap midpoint is ${fig('forecastMedian','forecastMedian',s)} with an interval from ${fig('forecastLow','forecastLow',s)} to ${fig('forecastHigh','forecastHigh',s)}, supported by ${fig('analogs','analogCount',s)} analogs.`);
    if(intent.kind!=='trust_the_model')paragraphs.push(engine.snapshot.news.some(n=>!n.preAnchor&&n.impact!==null&&(!n.symbols.length||n.symbols.includes(s)))?'The supplied news feed contributes to the attribution. Related headlines can overlap; they are not independent confirmations.':'The feed offers no measurable fresh news explanation for this name. Absence from this feed is not absence of news.');
  }
  paragraphs.push('Order-book depth, positioning, options pricing and news outside the supplied feed remain unseen. No position allocation is justified by this research alone.');
  if(intent.portfolioShared)paragraphs.push('Holdings mentioned in the question are used for this response only and are not stored or sent to the language provider. No portfolio sizing is inferred.');
  fig('sizeCeiling','sizeCeiling');fig('nextOpen','nextOpen');
  return {title,paragraphs:paragraphs.map(stripInlineDigits),figures,recommendation:{sizeCeilingPct:0,invalidatedIf:row&&!intent.unsupported.length?`${row.instrument.symbol} crosses its current reckoning band or its liquidity assessment changes; recompute the thesis.`:'Fresh covered quotes and a usable forecast become available.',watchFor:row?`A fresh ${row.instrument.underlying} headline confirmed by sustained trading volume.`:'The next usable market snapshot.',resolvesAt:engine.snapshot.session.nextOpenTs},confidence:'low',confidenceReason:'The data is simulated and the forecast has not been validated against real market history.'};
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
/** Validate structure and references, then enforce numeric provenance on every prose field. */
export function validateResearchNote(value:unknown,engine:EngineSnapshot):ResearchNote {
  if(!object(value)||typeof value.title!=='string'||!Array.isArray(value.paragraphs)||!value.paragraphs.length||value.paragraphs.some(p=>typeof p!=='string')||!Array.isArray(value.figures)||!object(value.recommendation)||!['low','moderate','high'].includes(String(value.confidence))||typeof value.confidenceReason!=='string')throw new Error('Malformed research note');
  const rec=value.recommendation;
  if(typeof rec.sizeCeilingPct!=='number'||!Number.isFinite(rec.sizeCeilingPct)||typeof rec.resolvesAt!=='number'||!Number.isFinite(rec.resolvesAt)||typeof rec.invalidatedIf!=='string'||!rec.invalidatedIf.trim()||typeof rec.watchFor!=='string'||!rec.watchFor.trim())throw new Error('Incomplete recommendation');
  const names=new Set<string>();
  for(const ref of value.figures){
    if(!object(ref)||typeof ref.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]*$/.test(ref.name)||names.has(ref.name)||!FIGURE_KINDS.includes(ref.kind as FigureKind)||(ref.symbol!==undefined&&typeof ref.symbol!=='string')||(ref.origin!==undefined&&!['live','backtest'].includes(String(ref.origin)))||(ref.trust!==undefined&&!['thin','moderate','deep','all'].includes(String(ref.trust))))throw new Error('Invalid figure');
    names.add(ref.name);const f=resolveFigure(ref as unknown as FigureRef,engine);if(f.value!==null&&!Number.isFinite(f.value))throw new Error('Nonfinite figure');
  }
  const note=value as unknown as ResearchNote;
  const prose=[note.title,...note.paragraphs,note.confidenceReason,rec.invalidatedIf,rec.watchFor] as string[];
  if(prose.join(' ').split(/\s+/).length>300)throw new Error('Research note exceeds prose limit');
  if(note.title.includes('{{'))throw new Error('Title must not contain figure references');
  for(const text of prose){
    for(const match of text.matchAll(/\{\{fig:([A-Za-z][A-Za-z0-9_]*)\}\}/g))if(!names.has(match[1]!))throw new Error('Unresolved figure');
    if(/[{}]/.test(text.replace(/\{\{fig:[A-Za-z][A-Za-z0-9_]*\}\}/g,'')))throw new Error('Malformed figure reference');
  }
  const figures=note.figures.filter(f=>!['sizeCeiling','nextOpen'].includes(f.name));
  figures.push({name:'sizeCeiling',kind:'sizeCeiling'},{name:'nextOpen',kind:'nextOpen'});
  return {...note,title:stripInlineDigits(note.title),paragraphs:note.paragraphs.map(stripInlineDigits),confidenceReason:stripInlineDigits(note.confidenceReason),figures,recommendation:{sizeCeilingPct:0,resolvesAt:engine.snapshot.session.nextOpenTs,invalidatedIf:stripInlineDigits(rec.invalidatedIf),watchFor:stripInlineDigits(rec.watchFor)}};
}
