import { unpackAnalogs, type CompactAnalogs, type ParamsArtifact, type RawHistory, type Snapshot } from '@engine/artifacts';
import { forecastEvidence } from '@engine/forecast';
import { buildFix, MODEL_VERSION, shouldLogFix } from '@engine/score';
import { selectParams } from '@engine/params';
import type { Fix } from '@engine/types';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { researchAt } from './research';
import { classifyCachedNews } from './classify-news';
import { getSessionInfo } from '@engine/calendar';
import { main,readArtifact,readJson,readLedger,writeArtifact,type PipelineContext } from './pipeline-context';
export async function snapshot(c:PipelineContext):Promise<void> {
  const params=(await readArtifact<ParamsArtifact>(c,'params')).data,history=await readJson<RawHistory>(c,'raw/history.json');
  const index=unpackAnalogs((await readArtifact<CompactAnalogs>(c,'analogs')).data);
  const provider=new SyntheticProvider(c.seed,()=>c.asOf);
  const {samples,news,session}=await researchAt(provider,history,params,c.asOf,index,true,items=>classifyCachedNews(c.root,items,history.universe.map(i=>i.symbol),getSessionInfo(c.asOf).anchorCloseTs));
  const ledger=await readLedger<Fix>(c,'ledger-live'),before=ledger.length;
  for(const {row} of samples) {
    if(!row.forecast||!shouldLogFix(row.reckoning,session,ledger,c.asOf))continue;
    const selected=selectParams(params.instruments[row.instrument.symbol]!,params.buckets[row.instrument.symbol],row.liquidity.label);
    ledger.push(await buildFix({reckoning:row.reckoning,forecast:row.forecast,session,modelVersion:MODEL_VERSION,origin:'live',loggedAt:c.asOf,confidenceMultiplier:forecastEvidence(row.forecast,selected).confidenceMultiplier}));
  }
  const data:Snapshot={ts:c.asOf,session,rows:samples.map(s=>s.row),news};
  await writeArtifact(c,'snapshot',data);await writeArtifact(c,'ledger-live',ledger);
  console.log(`Snapshot: ${samples.length} instruments, ${ledger.length-before} new fixes. Source: synthetic; forward ledger is simulated, not real-market performance.`);
}
main(import.meta.url,snapshot);
