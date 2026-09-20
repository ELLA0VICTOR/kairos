import type { ParamsArtifact } from '@engine/artifacts';
import { resolveFix,voidForAction } from '@engine/score';
import type { Fix } from '@engine/types';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { main,readArtifact,readLedger,writeArtifact,type PipelineContext } from './pipeline-context';
export async function resolveLedger(c:PipelineContext):Promise<void> {
  const params=(await readArtifact<ParamsArtifact>(c,'params')).data,ledger=await readLedger<Fix>(c,'ledger-live');
  const provider=new SyntheticProvider(c.seed,()=>c.asOf),universe=await provider.getUniverse();
  let resolved=0,voided=0;
  const output=ledger.map(f=>{
    if(f.status!=='open'||f.targetOpenTs>c.asOf)return f;
    const checked=voidForAction(f,params.corporateActions,c.asOf);
    if(checked.status==='void'){voided++;return checked;}
    const instrument=universe.find(i=>i.symbol===f.symbol);if(!instrument)return f;
    const open=provider.officialOpen(instrument.underlying,f.targetOpenTs);resolved++;
    return resolveFix(f,open,c.asOf);
  });
  await writeArtifact(c,'ledger-live',output);console.log(`Resolve: ${resolved} closed, ${voided} void, ${output.filter(f=>f.status==='open').length} awaiting a bell.`);
}
main(import.meta.url,resolveLedger);
