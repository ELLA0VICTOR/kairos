import type { Quote } from './types.js';
import { clamp } from './stats.js';
import { cleanQuote, noVolumeMove } from './quality.js';
export interface LiquidityAssessment {
  volumeSinceClose:number|null; expectedVolume:number; volumeRatio:number; spreadBps:number|null;
  trust:number; label:'thin'|'moderate'|'deep'; reasons:string[];
}
export function trustLabel(trust:number): LiquidityAssessment['label'] { return trust<.33?'thin':trust<.66?'moderate':'deep'; }
export function assessLiquidity(raw:Quote,expectedVolume:number,moveSize:number):LiquidityAssessment {
  if (!(expectedVolume>0) || !Number.isFinite(expectedVolume)) throw new Error('Expected volume must be finite and positive');
  const q=cleanQuote(raw),volumeRatio=Math.max(0,q.volumeSinceClose??0)/expectedVolume;
  const spreadBps=q.bid!==null&&q.ask!==null&&q.bid>0?(q.ask-q.bid)/((q.ask+q.bid)/2)*10000:null;
  const volScore=clamp(Math.log10(1+volumeRatio)/Math.log10(3));
  const spreadScore=spreadBps===null?.5:clamp(1-(spreadBps-5)/45);
  const efficiency=volumeRatio/Math.max(Math.abs(moveSize)/.01,1);
  const effScore=clamp(Math.log10(1+efficiency)/Math.log10(3));
  const trust=noVolumeMove(q,moveSize)?0:clamp(.45*volScore+.20*spreadScore+.35*effScore);
  const money=(v:number):string=>v>=1e6?`$${(v/1e6).toFixed(1)}M`:`$${Math.round(v/1000)}k`;
  const reasons=[q.volumeSinceClose===null?'Volume since the close is unavailable':`${money(q.volumeSinceClose)} traded, about ${Math.round(volumeRatio*100)}% of a typical comparable window`];
  if(noVolumeMove(q,moveSize)) reasons.push('No volume behind this move');
  else if(efficiency<.25&&Math.abs(moveSize)>.01) reasons.push(`A ${((Math.exp(Math.abs(moveSize))-1)*100).toFixed(1)}% move on this volume is unusual`);
  reasons.push(spreadBps===null?'Quoted spread unavailable':`Quoted spread ${spreadBps.toFixed(0)} bps`);
  return {volumeSinceClose:q.volumeSinceClose,expectedVolume,volumeRatio,spreadBps,trust,label:trustLabel(trust),reasons};
}
