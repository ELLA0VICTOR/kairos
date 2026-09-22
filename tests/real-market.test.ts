import {expect,test} from 'vitest';
import {initialArtifacts} from '../src/data/artifacts';
import type {RealMarket} from '../engine/artifacts';
import {realMarketBoard} from '../engine/real-market';
import {nyDate,previousClose} from '../engine/calendar';
import {rankedRows,parseIntent,templateResearchNote} from '../engine/research';
const now=Date.parse('2026-09-22T02:00:00Z');
function fixture(){
 const data=structuredClone(initialArtifacts);data.source='live';
 const quotes=data.snapshot.rows.map(r=>({...r.quote,ts:now}));
 const bundle:RealMarket={data,anchorDate:nyDate(previousClose(now)),historyAsOf:now,anchors:Object.fromEntries(data.snapshot.rows.map(r=>[r.instrument.symbol,r.reckoning.anchorPrice]))};
 return {bundle,quotes};
}
test('real board refuses stale/missing quotes and mismatched official-close anchors',()=>{
 const {bundle,quotes}=fixture();
 expect(realMarketBoard(bundle,quotes,now).rows).toHaveLength(20);
 expect(()=>realMarketBoard({...bundle,anchorDate:'2026-09-18'},quotes,now)).toThrow('anchors');
 expect(()=>realMarketBoard(bundle,quotes.slice(1),now)).toThrow('Incomplete');
 expect(()=>realMarketBoard(bundle,quotes.map(q=>({...q,ts:now-16*60000})),now)).toThrow('stale');
});
test('unstable names are excluded from unsolicited scans but explicit questions disclose the flag',()=>{
 const {bundle}=fixture(),data=bundle.data;
 data.params.instruments.rAAPL!.estimateStability='unstable';
 expect(rankedRows(data).some(r=>r.instrument.symbol==='rAAPL')).toBe(false);
 const note=templateResearchNote(parseIntent('Explain rAAPL',data),data);
 expect(note.paragraphs.join(' ')).toContain('failed stability checks');
 expect(note.confidenceReason).toContain('cold-start');
});
