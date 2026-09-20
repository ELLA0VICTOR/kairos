import { expect,test } from 'vitest';
import { packAnalogs,unpackAnalogs } from '@engine/artifacts';
import type { AnalogRecord } from '@engine/analogs';
import { computeStats } from '@engine/score';
import type { Fix } from '@engine/types';
import ledger from './fixtures/ledger-resolved.json';
import { instrument,TS } from './helpers';
test('compact analog round trip preserves signed drift and outcomes within 0.1 basis point',()=>{
  const r:AnalogRecord={id:`rNVDA:${TS}:60`,symbol:'rNVDA',date:'2026-09-20',drift:-.012345,absDrift:.012345,explainedShare:.32,trust:.21,windowType:'weekend',sectorKey:'semis',windowProgress:.6,realisedVolRegime:1.12,newsCategory:'guidance',realisedGap:.006123};
  const packed=packAnalogs([r],[instrument],[{anchorCloseTs:TS,targetOpenTs:TS+3600000,type:'weekend'}]);
  const decoded=unpackAnalogs(packed)[0]!;
  expect(Math.abs(decoded.drift-r.drift)).toBeLessThanOrEqual(.00001);
  expect(Math.abs(decoded.realisedGap-r.realisedGap)).toBeLessThanOrEqual(.00001);
  expect(decoded.drift).toBeLessThan(0);expect(decoded.newsCategory).toBe('guidance');
  expect(()=>unpackAnalogs({...packed,scale:1000})).toThrow('schema');
});
test('frozen 200-fix quantile grid has exactly 80% band coverage',()=>{
  // Midpoint probabilities .0025,.0075,...,.9975: exactly 160 lie inside [.1,.9].
  const stats=computeStats(ledger as Fix[],{rNVDA:'semis'});
  expect(stats.n).toBe(200);expect(stats.bandCoverage).toBe(.8);
  expect(stats.bySector.semis.n).toBe(200);
  expect(stats.calibration.reduce((s,b)=>s+b.n,0)).toBe(200);
});
