import { estimateParameters } from '@engine/params';
import { nyDate } from '@engine/calendar';
import type { ParamsArtifact, RawHistory } from '@engine/artifacts';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { main, readJson, writeArtifact, writeJson, type PipelineContext } from './pipeline-context';
import { researchAt, reversionObservations, volumeTable, type Sample } from './research';
export async function buildParams(c:PipelineContext):Promise<void> {
  const history=await readJson<RawHistory>(c,'raw/history.json'),p=new SyntheticProvider(c.seed,()=>c.asOf);
  await Promise.all(history.universe.map(i=>p.getDailyBars(i.underlying,750)));
  const samples:Sample[]=[];
  for(let wi=0;wi<history.windows.length;wi++) {
    const window=history.windows[wi]!;
    // Walk forward: the model only sees daily bars through this window's anchor.
    const anchorDate=nyDate(window.anchorCloseTs);
    const prior=Object.fromEntries(Object.entries(history.bars).map(([s,bars])=>[s,bars.filter(b=>b.date<=anchorDate)]));
    const estimates=estimateParameters(history.universe,prior,window.anchorCloseTs,reversionObservations(samples,window.anchorCloseTs));
    const params:ParamsArtifact={...estimates,expectedVolumes:volumeTable(samples),corporateActions:[]};
    for(const progress of [.15,.30,.45,.60,.75,.90]) {
      const ts=window.anchorCloseTs+Math.round((window.targetOpenTs-window.anchorCloseTs)*progress);
      const result=await researchAt(p,history,params,ts,[],false);
      samples.push(...result.samples.map(s=>({...s,windowIndex:wi})));
    }
    p.clearWindowCache();
    if((wi+1)%50===0)console.log(`Parameters: reconstructed ${wi+1}/${history.windows.length} windows with prior-only estimates.`);
  }
  const estimates=estimateParameters(history.universe,history.bars,c.asOf,reversionObservations(samples,c.asOf));
  const params:ParamsArtifact={...estimates,expectedVolumes:volumeTable(samples),corporateActions:[]};
  await writeJson(c,'raw/research-samples.json',samples);
  await writeArtifact(c,'params',params);await writeArtifact(c,'universe',history.universe);
  console.log(`Parameters: ${history.universe.length} instruments, three reversion buckets, ${samples.length} historical samples.`);
}
main(import.meta.url,buildParams);
