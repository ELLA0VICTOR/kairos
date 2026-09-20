import { atNy, getSessionInfo } from '@engine/calendar';
import type { RawHistory, HistoricalWindow } from '@engine/artifacts';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { main, writeJson, type PipelineContext } from './pipeline-context';
export async function fetchHistory(c:PipelineContext):Promise<void> {
  const p=new SyntheticProvider(c.seed,()=>c.asOf),universe=await p.getUniverse();
  const bars=Object.fromEntries(await Promise.all(universe.map(async i=>[i.symbol,await p.getDailyBars(i.underlying,750)] as const)));
  const anchor=bars.rQQQ!;
  const windows:HistoricalWindow[]=anchor.slice(0,-1).map((_b,i):HistoricalWindow=>{
    const next=anchor[i+1]!;
    const targetOpenTs=atNy(next.date,'09:30'),session=getSessionInfo(targetOpenTs-6*3600000);
    return {anchorCloseTs:session.anchorCloseTs,targetOpenTs,type:session.state==='holiday'?'holiday':session.state==='weekend'?'weekend':'overnight'};
  }).filter(w=>w.targetOpenTs<=c.asOf).slice(-250);
  const history:RawHistory={universe,bars,windows};
  await writeJson(c,'raw/history.json',history);
  console.log(`History: ${universe.length} instruments, ${anchor.length} daily bars, ${windows.length} closed windows (synthetic).`);
}
main(import.meta.url,fetchHistory);
