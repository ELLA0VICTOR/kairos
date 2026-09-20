import {expect,test,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Waterfall,ForecastCone,ReckoningChart,AnalogStrip} from '@/components/charts/InstrumentCharts';
import {reckon} from '@engine/reckon';
import {getSessionInfo} from '@engine/calendar';
import {input} from './helpers';
vi.mock('@/hooks/useResizeObserver',()=>({useResizeObserver:()=>({ref:{current:null},width:600})}));
test('waterfall preserves additive values and encodes absence with a hollow bar',()=>{
 const a={market:.01,sector:-.005,news:.002,unaccounted:.03,total:.037,newsDrivers:[]};
 const html=renderToStaticMarkup(<Waterfall value={a}/>);
 expect(a.market+a.sector+a.news+a.unaccounted).toBeCloseTo(a.total,12);
 expect(html).toMatch(/data-component="unaccounted"[^>]+fill="none"/);
 expect(html).toContain('<table');expect(html).toContain('0.037');
});
test('cone and strip expose every outcome, including tails outside the model interval',()=>{
 const outcomes=[-.09,-.03,0,.02,.08],f={symbol:'rTSLA',ts:1,median:-.01,p10:-.04,p90:.02,pTokenFalls:.7,analogCount:5,baseline:0 as const};
 const cone=renderToStaticMarkup(<ForecastCone forecast={f} outcomes={outcomes}/>),strip=renderToStaticMarkup(<AnalogStrip outcomes={outcomes} median={0} forecast={-.01}/>);
 expect(cone.match(/class="analog-outcome"/g)).toHaveLength(5);
 for(const v of outcomes){expect(cone).toContain(`<td>${v}</td>`);expect(strip).toContain(`<td>${v}</td>`);}
 expect(cone).not.toMatch(/NaN|Infinity/);
});
test('price chart keeps exact data in the accessible table and supports keyboard inspection',()=>{
 const r=reckon(input()),html=renderToStaticMarkup(<ReckoningChart points={[r,{...r,ts:r.ts+3600000}]} session={getSessionInfo(r.ts)} symbol={r.symbol}/>);
 expect(html).toContain('left and right arrow keys');expect(html).toContain(`<td>${r.bandLow}</td>`);expect(html).not.toMatch(/NaN|Infinity|preserveAspectRatio="none"/);
});
