import { expect,test } from 'vitest';
import { boardSentence } from '@engine/board';
import type { SnapshotRow } from '@engine/artifacts';
import { countdown } from '@/lib/format';
import { bandThickness } from '@/lib/session';
import { reckon } from '@engine/reckon';
import { input } from './helpers';
const row=(drift:number,total:number,market:number,unaccounted:number):SnapshotRow=>{const x=input(),r=reckon(x);return {instrument:x.instrument,quote:x.quote!,reckoning:{...r,drift,components:{...r.components,total,market,unaccounted}},liquidity:x.liquidity,forecast:null,evidence:null,stale:false};};
test('board closing copy covers quiet, market-wide, mixed, and empty windows',()=>{
 expect(boardSentence([])).toContain('No instruments');
 expect(boardSentence([row(.002,.002,0,.002)])).toContain('Nothing much');
 expect(boardSentence([row(.03,.03,.025,.005)])).toContain('market-wide');
 expect(boardSentence([row(.03,.03,.002,.03),row(.03,.03,.002,.002)])).toContain('1 name moved');
});
test('countdown preserves unbounded hours and clamps negative duration',()=>{expect(countdown((61*3600+42*60+7)*1000)).toBe('61:42:07');expect(countdown(-1)).toBe('00:00:00');});
test('session band thickens from Saturday afternoon to final pre-open hour',()=>{const bell=Date.parse('2026-09-21T13:30:00Z');expect(bandThickness(Date.parse('2026-09-19T16:00:00Z'),bell)).toBe(6);expect(bandThickness(bell-1800000,bell)).toBe(28);});
