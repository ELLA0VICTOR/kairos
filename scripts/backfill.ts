import { unpackAnalogs, type CompactAnalogs } from '@engine/artifacts';
import { analogScales, findAnalogs, type AnalogRecord } from '@engine/analogs';
import { forecastEvidence, forecastGap } from '@engine/forecast';
import { buildFix, computeStats, MODEL_VERSION, resolveFix, shouldLogFix } from '@engine/score';
import type { Fix } from '@engine/types';
import { main,readArtifact,readJson,writeArtifact,type PipelineContext } from './pipeline-context';
import type { Sample } from './research';
export async function backfill(c:PipelineContext):Promise<void> {
  const samples=await readJson<Sample[]>(c,'raw/research-samples.json');
  const compact=(await readArtifact<CompactAnalogs>(c,'analogs')).data,index=unpackAnalogs(compact);
  const resolvedById=new Map(compact.windows.map(w=>[w.anchorCloseTs,w.targetOpenTs]));
  const ledger:Fix[]=[];
  const start=c.asOf-180*86400_000;
  let counter=0;
  let priorAnchor=-1,prior:AnalogRecord[]=[],scales:number[]=[];
  for(const sample of samples) {
    const {input,row,features,realisedOpen}=sample;
    if(input.ts<start||sample.targetOpenTs>c.asOf||!shouldLogFix(row.reckoning,input.session!,ledger,input.ts))continue;
    // No same-window outcomes or later windows may leak into historical analog retrieval.
    if(priorAnchor!==input.session!.anchorCloseTs){
      priorAnchor=input.session!.anchorCloseTs;
      prior=index.filter(r=>(resolvedById.get(Number(r.id.split(':')[1]))??Infinity)<=priorAnchor);
      scales=analogScales(prior);
    }
    const analogs=findAnalogs(features,prior,80,scales);
    const forecast=forecastGap(row.reckoning,input.params,row.liquidity,analogs);
    const evidence=forecastEvidence(forecast,input.params);
    const fix=await buildFix({reckoning:row.reckoning,forecast,session:input.session!,modelVersion:MODEL_VERSION,origin:'backtest',loggedAt:input.ts,confidenceMultiplier:evidence.confidenceMultiplier});
    ledger.push(resolveFix(fix,realisedOpen,sample.targetOpenTs));
    if(++counter%1000===0)console.log(`Backfill: ${counter} resolved synthetic fixes.`);
  }
  await writeArtifact(c,'ledger-backtest',ledger);
  const sectors=Object.fromEntries(compact.symbols.map(i=>[i.symbol,i.sector]));
  console.log('Backtest statistics:',JSON.stringify(computeStats(ledger,sectors)));
  console.log(`Backfill: ${ledger.length} resolved fixes across the last 180 calendar days; reconstructed synthetic paths, not live performance.`);
}
main(import.meta.url,backfill);
