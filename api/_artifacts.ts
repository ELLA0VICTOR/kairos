import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCHEMA_VERSION,unpackAnalogs,type ArtifactSet,type CompactAnalogs,type ParamsArtifact,type Snapshot,type RealMarket } from '../engine/artifacts.js';
import {realResearchData} from '../engine/real-market.js';
import {adaptQuotes} from '../src/data/providers/bitget-adapters.js';
import {bitgetRequest} from './_bitget.js';
import type { Fix,Instrument } from '../engine/types.js';
async function artifact<T>(name:string):Promise<T>{
  const raw:unknown=JSON.parse(await readFile(resolve(process.cwd(),'public/data',name+'.json'),'utf8'));
  if(!raw||typeof raw!=='object'||!('schemaVersion' in raw)||raw.schemaVersion!==SCHEMA_VERSION||!('data' in raw))throw new Error('Invalid research artifact');
  return raw.data as T;
}
export async function loadResearchArtifacts():Promise<ArtifactSet>{
  if(process.env.VITE_DATA_SOURCE==='auto'){
    try{const bundle=JSON.parse(await readFile(resolve(process.cwd(),'public/data/real-market.json'),'utf8')) as RealMarket;
      const quotes=adaptQuotes(await bitgetRequest({method:'quotes'}),bundle.data.universe.map(i=>i.symbol));
      return realResearchData(bundle,quotes.quotes,Date.now());
    }catch{/* Whole-bundle fallback; never mix simulated anchors with live quotes. */}
  }
  const [snapshot,params,universe,compact,ledgerLive,ledgerBacktest]=await Promise.all([artifact<Snapshot>('snapshot'),artifact<ParamsArtifact>('params'),artifact<Instrument[]>('universe'),artifact<CompactAnalogs>('analogs'),artifact<Fix[]>('ledger-live'),artifact<Fix[]>('ledger-backtest')]);
  return {snapshot,params,universe,analogs:unpackAnalogs(compact),ledgerLive,ledgerBacktest};
}
