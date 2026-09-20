import {expect,test,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildFix,computeStats,resolveFix,voidForAction} from '@engine/score';
import {reckon} from '@engine/reckon';
import {getSessionInfo} from '@engine/calendar';
import {RecordMetrics} from '@/components/domain/RecordMetrics';
import {FixRows} from '@/components/domain/FixRows';
import {CalibrationPlot} from '@/components/charts/CalibrationPlot';
import {binomialBand,filterLedger,trustSentence} from '@/lib/record';
import {input,TS} from './helpers';
vi.mock('@/hooks/useResizeObserver',()=>({useResizeObserver:()=>({ref:{current:null},width:320})}));
async function negativeFix(){const r=reckon(input()),session=getSessionInfo(TS),f=await buildFix({reckoning:r,forecast:{symbol:r.symbol,ts:TS,median:-.02,p10:-.03,p90:-.01,pTokenFalls:.8,analogCount:40,baseline:0},session,modelVersion:'fixture',origin:'backtest',loggedAt:TS});return resolveFix(f,f.tokenPrice*Math.exp(.01),session.nextOpenTs);}
test('negative skill fixture renders the actual negative score and worse-than-baseline explanation',async()=>{
 const stats=computeStats([await negativeFix()]),html=renderToStaticMarkup(<RecordMetrics stats={stats} title="Backtest"/>);
 expect(stats.skillScore).toBeCloseTo(-8,10);expect(html).toContain('−8.00');expect(html).toContain('performs worse');expect(html).toContain('Bands are too narrow');
});
test('void fixes remain visible and struck through, but never enter statistics',async()=>{
 const f=await negativeFix(),v=voidForAction({...f,status:'open'},[{symbol:f.symbol,effectiveTs:f.loggedAt+1,kind:'split'}],f.targetOpenTs);
 const html=renderToStaticMarkup(<FixRows fixes={[v]} label="Voids"/>);
 expect(html).toContain('fix-void');expect(html).toContain('Void');expect(computeStats([f,v]).n).toBe(1);expect(computeStats([v]).n).toBe(0);
});
test('origin, sector and trust filters yield exactly the exported JSON set',async()=>{
 const f=await negativeFix(),rows=[{...f,trust:.1},{...f,id:'other-origin',origin:'live' as const,trust:.1},{...f,id:'other-sector',symbol:'rJPM',trust:.1},{...f,id:'other-trust',trust:.8}];
 const filtered=filterLedger(rows,{origin:'backtest',sector:'semis',trust:'thin'},{rNVDA:'semis',rJPM:'financials'});
 expect(JSON.parse(JSON.stringify(filtered))).toEqual([rows[0]]);
 expect(()=>computeStats(rows)).toThrow('never be pooled');
});
test('trust thesis supports, contradicts and withholds a conclusion when appropriate',()=>{
 const stats=computeStats([]);expect(trustSentence(stats)).toContain('not enough');
 stats.byTrust.thin={n:20,hitRate:.6,skillScore:.2};stats.byTrust.deep={n:30,hitRate:.5,skillScore:.1};
 expect(trustSentence(stats)).toContain('supports');stats.byTrust.thin.skillScore=-.1;expect(trustSentence(stats)).toContain('contradicts');
});
test('binomial band matches the exact ten-trial distribution and stays finite for large buckets',()=>{
 expect(binomialBand(.5,10)).toEqual([.2,.8]);expect(binomialBand(0,10)).toEqual([0,0]);expect(binomialBand(1,10)).toEqual([1,1]);
 const band=binomialBand(.99,3000);expect(band[0]).toBeLessThan(.99);expect(band[1]).toBeGreaterThan(.99);expect(band.every(Number.isFinite)).toBe(true);
});
test('calibration omits empty bins and retains bucket sample sizes in the chart table',()=>{
 const html=renderToStaticMarkup(<CalibrationPlot data={[{bucket:1,predicted:.15,realised:.2,n:10},{bucket:2,predicted:.25,realised:0,n:0}]}/>);
 expect(html).toContain('<td>10</td>');expect(html).not.toContain('<td>0.25</td>');expect(html).not.toMatch(/NaN|Infinity/);
});
