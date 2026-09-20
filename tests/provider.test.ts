import { expect, test } from 'vitest';
import { atNy, getSessionInfo, HOUR } from '@engine/calendar';
import { ANCHORS } from '@/data/providers/anchors';
import { SyntheticProvider } from '@/data/providers/synthetic';
import { ProviderError } from '@/data/providers/types';
import weekend from './fixtures/window-weekend.json';
import overnight from './fixtures/window-overnight.json';

test('same seed and timestamp produce byte-identical quotes, candles, news and history',async()=>{
  const a=new SyntheticProvider(42,()=>weekend.ts),b=new SyntheticProvider(42,()=>weekend.ts);
  const collect=async(p:SyntheticProvider)=>({quotes:await p.getQuotes(['rTSLA','rNVDA']),candles:await p.getWindowCandles('rTSLA',weekend.session.anchorCloseTs,15),news:await p.getNews(weekend.session.anchorCloseTs),bars:await p.getDailyBars('NVDA',400)});
  expect(JSON.stringify(await collect(a))).toBe(JSON.stringify(await collect(b)));
});
test('adding or reordering instruments cannot perturb existing series',async()=>{
  const a=new SyntheticProvider(42,()=>weekend.ts);
  const added={...ANCHORS[2]!,symbol:'rTEST',underlying:'TEST'};
  const b=new SyntheticProvider(42,()=>weekend.ts,[added,...ANCHORS].reverse());
  expect(await a.getQuotes(['rTSLA','rNVDA'])).toEqual(await b.getQuotes(['rTSLA','rNVDA']));
  expect(await a.getDailyBars('NVDA',400)).toEqual(await b.getDailyBars('NVDA',400));
});
test('frozen weekend contains ghost, news, risk-off and quiet intervals',()=>{
  const tesla=weekend.paths.rTSLA.at(-1)!,nvda=weekend.paths.rNVDA.at(-1)!;
  expect(tesla.idio).toBeGreaterThan(.04); expect(tesla.idio).toBeLessThan(.055);
  expect(nvda.news).toBeCloseTo(.1*Math.tanh(.035/.1),12);
  expect(nvda.cumulativeVolume).toBeGreaterThan(tesla.cumulativeVolume*30);
  const start=weekend.session.anchorCloseTs+weekend.session.windowDurationMs*.2;
  const path=weekend.paths.rQQQ;
  const before=path.find(p=>p.ts>=start)!,after=path.find(p=>p.ts>=start+3*HOUR)!;
  expect(after.market-before.market).toBeLessThan(-.01);
  for(const symbol of ['rAAPL','rMSFT','rJPM'] as const) {
    const points=weekend.paths[symbol].filter(p=>p.ts<start);
    expect(Math.max(...points.map(p=>Math.abs(p.idio)))).toBeLessThan(.001);
  }
});
test('weekend diurnal notional is 11% of equivalent weekday notional without scenario multipliers',()=>{
  const p=new SyntheticProvider();
  for(const hour of ['02:00','08:00','12:00','22:00']) {
    const sat=atNy('2026-09-19',hour),tue=atNy('2026-09-22',hour);
    const weekendRate=p.volumeRate('rAAPL',sat,sat-10*HOUR,false);
    const weekdayRate=p.volumeRate('rAAPL',tue,tue-10*HOUR,false);
    expect(weekendRate/weekdayRate).toBeCloseTo(.11,12);
  }
});
test('frozen session endpoints match live calendar',()=>{
  expect(getSessionInfo(weekend.ts)).toEqual(weekend.session);
  expect(weekend.session.state).toBe('weekend');
  expect(weekend.session.anchorCloseTs).toBe(Date.parse('2026-09-18T20:00:00Z'));
  expect(weekend.session.nextOpenTs).toBe(Date.parse('2026-09-21T13:30:00Z'));
  expect(getSessionInfo(overnight.ts)).toEqual(overnight.session);
  expect(overnight.session.state).toBe('overnight');
});
test('daily history has 400 distinct trading days and explicit gap identity',async()=>{
  const p=new SyntheticProvider(42,()=>weekend.ts),bars=await p.getDailyBars('NVDA',400);
  expect(bars).toHaveLength(400);
  for(let i=1;i<bars.length;i++) {
    const b=bars[i]!; expect(b.gapLogReturn).toBeCloseTo(Math.log(b.open/bars[i-1]!.close),12);
    expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open,b.close));
    expect(b.low).toBeLessThanOrEqual(Math.min(b.open,b.close));
  }
});
test('regular session quote starts at official open, news is visibly synthetic',async()=>{
  const ts=atNy('2026-09-22','09:30'),p=new SyntheticProvider(42,()=>ts);
  expect((await p.getQuotes(['rNVDA'])).quotes[0]!.price).toBe(p.officialOpen('NVDA',ts));
  expect((await p.getNews(ts-24*HOUR)).every(n=>n.source==='Kairos simulated wire')).toBe(true);
  await expect(p.getDailyBars('unknown',400)).rejects.toBeInstanceOf(ProviderError);
  await expect(p.getDailyBars('NVDA',0)).rejects.toBeInstanceOf(ProviderError);
});
