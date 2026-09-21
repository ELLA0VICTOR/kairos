import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCHEMA_VERSION,unpackAnalogs,type ArtifactSet,type CompactAnalogs,type ParamsArtifact,type Snapshot } from '../engine/artifacts';
import type { Fix,Instrument } from '../engine/types';
async function artifact<T>(name:string):Promise<T>{
  const raw:unknown=JSON.parse(await readFile(resolve(process.cwd(),'public/data',name+'.json'),'utf8'));
  if(!raw||typeof raw!=='object'||!('schemaVersion' in raw)||raw.schemaVersion!==SCHEMA_VERSION||!('data' in raw))throw new Error('Invalid research artifact');
  return raw.data as T;
}
export async function loadResearchArtifacts():Promise<ArtifactSet>{
  const [snapshot,params,universe,compact,ledgerLive,ledgerBacktest]=await Promise.all([artifact<Snapshot>('snapshot'),artifact<ParamsArtifact>('params'),artifact<Instrument[]>('universe'),artifact<CompactAnalogs>('analogs'),artifact<Fix[]>('ledger-live'),artifact<Fix[]>('ledger-backtest')]);
  return {snapshot,params,universe,analogs:unpackAnalogs(compact),ledgerLive,ledgerBacktest};
}
