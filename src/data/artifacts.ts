import { SCHEMA_VERSION, unpackAnalogs, type Artifact, type ArtifactSet, type CompactAnalogs, type ParamsArtifact, type Snapshot } from '@engine/artifacts';
import type { Fix, Instrument } from '@engine/types';
import snapshot from './fallback/snapshot.json';
import params from './fallback/params.json';
import universe from './fallback/universe.json';
// Legacy frozen simulation predates the real-history flag. Preserve its record;
// the live bundle always contains freshly computed stability classifications.
const demoParams:ParamsArtifact={...params.data,instruments:Object.fromEntries(Object.entries(params.data.instruments).map(([s,p])=>[s,{...p,estimateStability:'stable' as const}]))} as ParamsArtifact;
export const initialArtifacts:ArtifactSet={source:'synthetic',snapshot:snapshot.data as Snapshot,params:demoParams,universe:universe.data as Instrument[],analogs:[],ledgerBacktest:[],ledgerLive:[]};
export interface LoadedArtifacts {data:ArtifactSet;fallbacks:string[];generatedAt:number}
const names=['universe','params','analogs','snapshot','ledger-live','ledger-backtest'] as const;
async function fallback(name:typeof names[number]):Promise<unknown>{
  switch(name){case 'snapshot':return snapshot;case 'params':return params;case 'universe':return universe;
    case 'analogs':return (await import('./fallback/analogs.json')).default;
    case 'ledger-live':return (await import('./fallback/ledger-live.json')).default;
    case 'ledger-backtest':return (await import('./fallback/ledger-backtest.json')).default;}
}
export function validateArtifact(value:unknown,name:string):Artifact<unknown>{
  if(!value||typeof value!=='object'||!('schemaVersion' in value)||value.schemaVersion!==SCHEMA_VERSION)throw new Error(`${name}: incompatible schema`);
  const a=value as Artifact<unknown>;
  if(!Number.isFinite(a.generatedAt)||!a.modelVersion||!['synthetic','live'].includes(a.source)||a.data===undefined)throw new Error(`${name}: invalid artifact header`);
  return a;
}
export async function loadArtifacts(includeLedgers=true):Promise<LoadedArtifacts>{
  // Paint the bundled snapshot and its fonts before competing for bandwidth
  // with the much larger history downloads. Hidden tabs must not await rAF.
  if(typeof document!=='undefined'&&document.visibilityState==='visible'){
    await document.fonts.ready;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  }
  const requestedNames=includeLedgers?names:names.filter(name=>!name.startsWith('ledger-'));
  const results=await Promise.allSettled(requestedNames.map(async name=>{
    // Data modes are not URL prefixes. Tolerate the common deployment mix-up.
    const configured=import.meta.env.VITE_DATA_BASE??'',base=/^\/?(synthetic|auto)\/?$/.test(configured)?'':configured.replace(/\/$/,'');
    const response=await fetch(`${base}/data/${name}.json`,{signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
    return validateArtifact(await response.json(),name);
  }));
  const fallbacks:string[]=[],values:Record<string,Artifact<unknown>>={};
  for(let i=0;i<requestedNames.length;i++){const name=requestedNames[i]!,result=results[i]!;
    if(result.status==='fulfilled')values[name]=result.value;
    else{fallbacks.push(`${name}: ${result.reason instanceof Error?result.reason.message:'unavailable'}`);values[name]=validateArtifact(await fallback(name),name);}}
  const compact=values.analogs!.data as CompactAnalogs;
  return {generatedAt:values.snapshot!.generatedAt,fallbacks,data:{universe:values.universe!.data as Instrument[],params:values.params!.data as ParamsArtifact,analogs:includeLedgers?unpackAnalogs(compact):[],compactAnalogs:includeLedgers?undefined:compact,snapshot:values.snapshot!.data as Snapshot,ledgerLive:(values['ledger-live']?.data??[]) as Fix[],ledgerBacktest:(values['ledger-backtest']?.data??[]) as Fix[]}};
}
