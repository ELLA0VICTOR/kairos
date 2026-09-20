import { writeFile } from 'node:fs/promises';
import { getSessionInfo } from '@engine/calendar';
import { SyntheticProvider } from '@/data/providers/synthetic';
for (const [name,date] of [['weekend','2026-09-20T20:00:00Z'],['overnight','2026-09-23T02:00:00Z']] as const) {
  const ts=Date.parse(date),p=new SyntheticProvider(20260927,()=>ts),session=getSessionInfo(ts);
  const universe=await p.getUniverse(),symbols=universe.map(i=>i.symbol);
  const paths=Object.fromEntries(symbols.map(s=>[s,p.windowPath(s,session).filter(point=>point.ts<=ts)]));
  const fixture={seed:p.seed,ts,session,universe,quotes:await p.getQuotes(symbols),news:await p.getNews(session.anchorCloseTs),paths};
  await writeFile(`tests/fixtures/window-${name}.json`,JSON.stringify(fixture));
  if(name==='weekend') await writeFile('tests/fixtures/bars-nvda.json',JSON.stringify(await p.getDailyBars('NVDA',400)));
}
console.log('Frozen weekend, overnight and 400-day NVDA fixtures.');
