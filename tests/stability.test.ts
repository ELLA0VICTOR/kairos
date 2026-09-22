import {expect,test} from 'vitest';
import {validateBeta} from '../engine/stability';
import {reckon} from '../engine/reckon';
import {forecastGap} from '../engine/forecast';
import {findAnalogs} from '../engine/analogs';
import {input} from './helpers';
test('stability flags a significant full fit whose halves flip sign',()=>{
 const x=Array.from({length:250},(_,i)=>((i%5)-2)*.01),y=x.map((v,i)=>(i<125?2:-.1)*v+(i%3-1)*.0001);
 expect(validateBeta(x,y).estimateStability).toBe('unstable');
 expect(validateBeta(x,x.map(v=>1.7*v)).estimateStability).toBe('stable');
 expect(validateBeta(x,x,true).identityAnchor).toBe(true);
});
test('unstable params widen both intervals by 20% without shifting the estimate or double counting stale',()=>{
 const i=input(),stable=reckon(i),params={...i.params,estimateStability:'unstable' as const},unstable=reckon({...i,params});
 expect(unstable.reckonedValue).toBe(stable.reckonedValue);
 expect(Math.log(unstable.bandHigh/unstable.reckonedValue)/Math.log(stable.bandHigh/stable.reckonedValue)).toBeCloseTo(1.2,12);
 const stale=reckon({...i,params:{...params,estimatedAt:i.ts-20*86400000}});
 expect(stale.bandHigh).toBe(unstable.bandHigh);
 const analogs=findAnalogs({absDrift:.01,drift:.01,explainedShare:.5,trust:.5,windowType:'weekend',sectorKey:'semis',windowProgress:.5,realisedVolRegime:1,newsCategory:null},[]);
 const f=forecastGap(stable,i.params,i.liquidity,analogs),g=forecastGap(unstable,params,i.liquidity,analogs);
 expect(g.median).toBe(f.median);expect((g.p90-g.p10)/(f.p90-f.p10)).toBeCloseTo(1.2,12);
});
