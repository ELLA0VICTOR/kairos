import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage,ServerResponse } from 'node:http';
import type { Artifact,Snapshot } from '../engine/artifacts';
import { SCHEMA_VERSION } from '../engine/artifacts';
let cache:Artifact<Snapshot>|undefined,loadedAt=0;
/** Phase 9 serves the committed snapshot honestly; live upstream integration belongs to Phase 10. */
export default async function quotes(req:IncomingMessage,res:ServerResponse):Promise<void>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=20, stale-while-revalidate=120');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end(JSON.stringify({message:'Use GET to read saved quotes.'}));return;}
  try {
    if(!cache||Date.now()-loadedAt>20000){
      const value=JSON.parse(await readFile(resolve(process.cwd(),'public/data/snapshot.json'),'utf8')) as Artifact<Snapshot>;
      if(value.schemaVersion!==SCHEMA_VERSION||!Number.isFinite(value.generatedAt)||!Array.isArray(value.data?.rows))throw new Error('Invalid snapshot');
      cache=value;loadedAt=Date.now();
    }
  }catch{/* Retain the last known snapshot and its actual timestamp. */}
  const requested=new URL(req.url??'/', 'http://localhost').searchParams.get('symbols')?.split(',');
  res.end(JSON.stringify({asOf:cache?new Date(cache.data.ts).toISOString():null,source:'cache',dataSource:cache?.source??'unavailable',quotes:(cache?.data.rows??[]).filter(r=>!requested||requested.includes(r.instrument.symbol)).map(r=>r.quote),notice:cache?'Saved snapshot quotes; this endpoint is not a live market feed.':'No saved quotes are available.'}));
}
