import type { Fix, FixOrigin, GapForecast, Reckoning, SectorKey, SessionInfo } from './types.js';
import { clamp, mean, sha256Hex } from './stats.js';
import { trustLabel } from './liquidity.js';
export const MODEL_VERSION='1.2.0';
export const SECTORS:SectorKey[]=['semis','megacap_tech','crypto_beta','consumer_growth','financials','software'];
export function canonicalJson(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().filter(k=>record[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}
export interface FixInput {reckoning:Reckoning;forecast:GapForecast;session:SessionInfo;modelVersion:string;origin:FixOrigin;loggedAt:number;confidenceMultiplier?:number}
export async function buildFix(args:FixInput):Promise<Fix> {
  const {reckoning:r,forecast,session,modelVersion,origin,loggedAt}=args;
  return {id:`${r.symbol}:${session.anchorCloseTs}:${loggedAt}`,origin,status:'open',symbol:r.symbol,loggedAt,anchorCloseTs:session.anchorCloseTs,targetOpenTs:session.nextOpenTs,modelVersion,inputsHash:await sha256Hex(canonicalJson(args)),tokenPrice:r.tokenPrice,reckonedValue:r.reckonedValue,bandLow:r.bandLow,bandHigh:r.bandHigh,drift:r.drift,trust:r.trust,forecast,call:r.drift>.005?'rich':r.drift<-.005?'cheap':'fair',callConfidence:clamp(Math.abs(forecast.pTokenFalls-.5)*2*(args.confidenceMultiplier??1)),realisedOpen:null,realisedGap:null,resolvedAt:null,directionalHit:null,inBand:null,absError:null,baselineAbsError:null,brier:null};
}
export function shouldLogFix(r:Reckoning,session:SessionInfo,ledger:Fix[],ts:number):boolean {
  return session.isDark&&Math.abs(r.drift)>.004&&!ledger.some(f=>f.symbol===r.symbol&&f.anchorCloseTs===session.anchorCloseTs&&Math.floor(f.loggedAt/3600_000)===Math.floor(ts/3600_000));
}
export function resolveFix(fix:Fix,realisedOpen:number,resolvedAt:number):Fix {
  if(fix.status!=='open')return {...fix};
  if(!(realisedOpen>0)||!Number.isFinite(realisedOpen))throw new Error('Invalid realised open');
  if(resolvedAt<fix.targetOpenTs)throw new Error('Cannot resolve before target bell');
  const realisedGap=Math.log(realisedOpen/fix.tokenPrice);
  return {...fix,status:'closed',realisedOpen,realisedGap,resolvedAt,
    directionalHit:Math.sign(realisedGap)===Math.sign(fix.forecast.median)&&Math.abs(fix.forecast.median)>.001,
    inBand:realisedGap>=fix.forecast.p10&&realisedGap<=fix.forecast.p90,
    absError:Math.abs(realisedGap-fix.forecast.median),baselineAbsError:Math.abs(realisedGap),brier:(fix.forecast.pTokenFalls-(realisedGap<0?1:0))**2};
}
export interface CorporateAction {symbol:string;effectiveTs:number;kind:'split'|'special_dividend'}
export function voidForAction(fix:Fix,actions:CorporateAction[],resolvedAt:number):Fix {
  return actions.some(a=>a.symbol===fix.symbol&&a.effectiveTs>fix.loggedAt&&a.effectiveTs<=fix.targetOpenTs)?{...fix,status:'void',resolvedAt,realisedOpen:null,realisedGap:null,directionalHit:null,inBand:null,absError:null,baselineAbsError:null,brier:null}:{...fix};
}
type Cut={n:number;hitRate:number;skillScore:number};
export interface RecordStats {
  n:number;nOpen:number;directionalHitRate:number;bandCoverage:number;meanAbsError:number;
  baselineMeanAbsError:number;skillScore:number;meanBrier:number;
  calibration:Array<{bucket:number;predicted:number;realised:number;n:number}>;
  bySector:Record<SectorKey,Cut>;byTrust:Record<'thin'|'moderate'|'deep',Cut>;
}
function skill(rows:Fix[]):number {
  const model=rows.reduce((s,f)=>s+(f.realisedGap!-f.forecast.median)**2,0),baseline=rows.reduce((s,f)=>s+f.realisedGap!**2,0);
  // No baseline movement means no measured skill; zero avoids NaN/infinite scores.
  return baseline===0?0:1-model/baseline;
}
function cut(rows:Fix[]):Cut {return {n:rows.length,hitRate:rows.length?rows.filter(f=>f.directionalHit).length/rows.length:0,skillScore:skill(rows)};}
export function computeStats(fixes:Fix[],sectorBySymbol:Record<string,SectorKey>={}):RecordStats {
  if(new Set(fixes.map(f=>f.origin)).size>1)throw new Error('Live and backtest statistics must never be pooled');
  const rows=fixes.filter(f=>f.status==='closed'&&f.realisedGap!==null),n=rows.length;
  const avg=(fn:(f:Fix)=>number):number=>n?mean(rows.map(fn)):0;
  const bySector=Object.fromEntries(SECTORS.map(s=>[s,cut(rows.filter(f=>sectorBySymbol[f.symbol]===s))])) as Record<SectorKey,Cut>;
  const byTrust=Object.fromEntries((['thin','moderate','deep'] as const).map(s=>[s,cut(rows.filter(f=>trustLabel(f.trust)===s))])) as Record<'thin'|'moderate'|'deep',Cut>;
  const calibration=Array.from({length:10},(_,bucket)=>{
    // Calibrate the event the model actually probabilities: token falls at bell.
    const group=rows.filter(f=>Math.min(9,Math.floor(f.forecast.pTokenFalls*10))===bucket);
    return {bucket,predicted:group.length?mean(group.map(f=>f.forecast.pTokenFalls)):(bucket+.5)/10,realised:group.length?group.filter(f=>f.realisedGap!<0).length/group.length:0,n:group.length};
  });
  return {n,nOpen:fixes.filter(f=>f.status==='open').length,directionalHitRate:avg(f=>Number(f.directionalHit)),bandCoverage:avg(f=>Number(f.inBand)),meanAbsError:avg(f=>f.absError!),baselineMeanAbsError:avg(f=>f.baselineAbsError!),skillScore:skill(rows),meanBrier:avg(f=>f.brier!),calibration,bySector,byTrust};
}
