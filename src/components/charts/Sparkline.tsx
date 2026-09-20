import { memo } from 'react';
import { line,scale } from './axis';
export const Sparkline=memo(function Sparkline({values,symbol}:{values:number[];symbol:string}){
  if(values.length<2)return <span className="muted">No path yet</span>;
  const y=scale(Math.min(...values),Math.max(...values),18,2),x=scale(0,values.length-1,1,71);
  return <><svg width="72" height="20" role="img" aria-label={`${symbol} price path; latest ${values.at(-1)!.toFixed(2)} USDT`}><path d={line(values.map((v,i)=>[x(i),y(v)]))} fill="none" stroke="var(--bone-dim)"/><circle cx="71" cy={y(values.at(-1)!)} r="2" fill="var(--bone)"/></svg><table className="sr-only"><caption>{symbol} price path</caption><tbody>{values.map((v,i)=><tr key={i}><th>Sample {i+1}</th><td>{v}</td></tr>)}</tbody></table></>;
});
