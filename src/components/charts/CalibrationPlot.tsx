import type {RecordStats} from '@engine/score';
import {useResizeObserver} from '@/hooks/useResizeObserver';
import {binomialBand} from '@/lib/record';
import {share} from '@/lib/format';
import {ChartTable} from './InstrumentCharts';
import {line,scale,ticks} from './axis';
export function CalibrationPlot({data}:{data:RecordStats['calibration']}){
 const {ref,width}=useResizeObserver(),size=Math.min(320,width),x=scale(0,1,36,size-16),y=scale(0,1,size-32,16),rows=data.filter(d=>d.n>0),maxN=Math.max(1,...rows.map(d=>d.n));
 const bands=rows.map(d=>({...d,band:binomialBand(d.predicted,d.n)}));
 return <div ref={ref} className="chart calibration"><svg width={size} height={size} role="img" aria-label="Calibration of the probability that the token falls at the bell. Brass squares show realised frequency; shading is a central 90% binomial band for each bucket’s sample size.">
 {ticks(0,1,5).map(t=><g key={t}><line x1={36} x2={size-16} y1={y(t)} y2={y(t)} stroke="var(--rule)" opacity={.5}/><text x={30} y={y(t)+4} textAnchor="end" className="axis-text">{Math.round(t*100)}%</text><text x={x(t)} y={size-10} textAnchor="middle" className="axis-text">{Math.round(t*100)}%</text></g>)}
 {bands.length>1&&<path d={`${line(bands.map(d=>[x(d.predicted),y(d.band[1])]))} ${line([...bands].reverse().map(d=>[x(d.predicted),y(d.band[0])])).replace(/^M/,'L')}Z`} fill="var(--rule)" opacity={.4}/>}
 <line x1={x(0)} x2={x(1)} y1={y(0)} y2={y(1)} stroke="var(--rule-strong)" strokeDasharray="4 4"/>
 {bands.map(d=>{const s=5+5*Math.sqrt(d.n/maxN);return <rect key={d.bucket} x={x(d.predicted)-s/2} y={y(d.realised)-s/2} width={s} height={s} fill="var(--brass)"><title>{`Predicted ${share(d.predicted)}, realised ${share(d.realised)}, n=${d.n}`}</title></rect>;})}
 </svg><ChartTable label="Calibration probability buckets" heads={['Predicted','Realised','Count','90% low','90% high']} rows={bands.map(d=>[d.predicted,d.realised,d.n,...d.band])}/></div>;
}
