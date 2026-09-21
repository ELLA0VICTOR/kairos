import { mkdir,readFile,writeFile,mkdtemp,copyFile,stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect,test } from 'vitest';
import { computeStats, MODEL_VERSION } from '@engine/score';
import { unpackAnalogs, type Artifact, type CompactAnalogs, type ParamsArtifact } from '@engine/artifacts';
import type { Fix, Instrument } from '@engine/types';
import { snapshot } from '../scripts/snapshot';
import { resolveLedger } from '../scripts/resolve';
import { fetchHistory } from '../scripts/fetch-history';
import { readArtifact, type PipelineContext } from '../scripts/pipeline-context';
const names=['universe','params','analogs','snapshot','ledger-live','ledger-backtest'];
const base:PipelineContext={asOf:Date.parse('2026-09-20T20:00:00Z'),seed:20260927,root:process.cwd()};
function assertFinite(value:unknown):void {
  if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);
  else if(Array.isArray(value))value.forEach(assertFinite);
  else if(value&&typeof value==='object')Object.values(value).forEach(assertFinite);
}
async function isolatedContext():Promise<PipelineContext> {
  await mkdir(join(process.cwd(),'raw'),{recursive:true});
  const root=await mkdtemp(join(process.cwd(),'raw','pipeline-test-'));
  await mkdir(join(root,'public/data'),{recursive:true});await mkdir(join(root,'raw'),{recursive:true});
  for(const name of names)await copyFile(`public/data/${name}.json`,join(root,`public/data/${name}.json`));
  const c={...base,root};await fetchHistory(c);
  return c;
}
test('all six artifacts have headers and byte-identical bundled defaults',async()=>{
  for(const name of names){
    const a=await readFile(`public/data/${name}.json`,'utf8'),b=await readFile(`src/data/fallback/${name}.json`,'utf8');
    expect(a).toBe(b);
    const parsed=JSON.parse(a) as Artifact<unknown>;
    expect(parsed).toMatchObject({schemaVersion:1,modelVersion:MODEL_VERSION,source:'synthetic'});assertFinite(parsed);
  }
},15000);
test('30,000 compact analogs fit below 2MB and contain all six window samples',async()=>{
  const index=(await readArtifact<CompactAnalogs>(base,'analogs')).data;
  expect((await stat('public/data/analogs.json')).size).toBeLessThan(2_000_000);
  expect(index.rows.length).toBe(30000);
  expect(new Set(index.rows.map(row=>row[2]))).toEqual(new Set([15,30,45,60,75,90]));
  expect(unpackAnalogs(index)).toHaveLength(30000);
});
test('backfill exceeds 2,000 resolved fixes with finite, honest, separated statistics',async()=>{
  const ledger=(await readArtifact<Fix[]>(base,'ledger-backtest')).data;
  const universe=(await readArtifact<Instrument[]>(base,'universe')).data;
  expect(ledger.length).toBeGreaterThanOrEqual(2000);
  expect(ledger.every(f=>f.origin==='backtest'&&f.status==='closed')).toBe(true);
  expect(new Set(ledger.map(f=>f.id)).size).toBe(ledger.length);
  const stats=computeStats(ledger,Object.fromEntries(universe.map(i=>[i.symbol,i.sector])));assertFinite(stats);
  expect(stats.directionalHitRate).toBeGreaterThanOrEqual(0);expect(stats.directionalHitRate).toBeLessThanOrEqual(1);
  expect(stats.bandCoverage).toBeGreaterThanOrEqual(0);expect(stats.bandCoverage).toBeLessThanOrEqual(1);
});
test('snapshot twice within the same hour cannot duplicate forward fixes',async()=>{
  const c=await isolatedContext(),file=join(c.root,'public/data/ledger-live.json');
  const existing=await readArtifact<Fix[]>(c,'ledger-live');await writeFile(file,JSON.stringify({...existing,data:[]}));
  await snapshot(c);const first=(await readArtifact<Fix[]>(c,'ledger-live')).data;
  expect(first.length).toBeGreaterThan(0);
  await snapshot(c);
  const second=(await readArtifact<Fix[]>(c,'ledger-live')).data;
  expect(second).toEqual(first);
},20000);
test('pipeline resolves only after the bell, voids splits, and preserves the original forecast',async()=>{
  const c=await isolatedContext(),existing=await readArtifact<Fix[]>(c,'ledger-live');
  // Hosted refreshes resolve the committed ledger. Generate open fixes at the
  // fixed test timestamp instead of assuming today's artifact is still open.
  await writeFile(join(c.root,'public/data/ledger-live.json'),JSON.stringify({...existing,data:[]}));
  await snapshot(c);
  const original=(await readArtifact<Fix[]>(c,'ledger-live')).data;
  const f=original[0]!;expect(f).toBeDefined();
  await resolveLedger(c);expect((await readArtifact<Fix[]>(c,'ledger-live')).data).toEqual(original);
  const params=await readArtifact<ParamsArtifact>(c,'params');params.data.corporateActions=[{symbol:f.symbol,effectiveTs:f.targetOpenTs,kind:'split'}];
  await writeFile(join(c.root,'public/data/params.json'),JSON.stringify(params));
  await resolveLedger({...c,asOf:f.targetOpenTs+60000});
  const closed=(await readArtifact<Fix[]>(c,'ledger-live')).data;
  expect(closed.find(v=>v.id===f.id)?.status).toBe('void');
  expect(closed.some(v=>v.status==='closed')).toBe(true);
  for(const row of closed)expect(row.forecast).toEqual(original.find(v=>v.id===row.id)!.forecast);
},20000);
