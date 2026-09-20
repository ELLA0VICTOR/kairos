import type { Attribution, Reckoning } from './types';
import { decompose, type ReckonInput } from './reckon';
import { clamp } from './stats';
export function attribute(input:ReckonInput,_reckoning:Reckoning):Attribution { return decompose(input); }
export function explainedShare(a:Attribution):number { return Math.abs(a.total)<1e-6?1:clamp(1-Math.abs(a.unaccounted)/Math.abs(a.total)); }
export function attributionSentence(a:Attribution,trust:number):string {
  const explained=explainedShare(a);
  if(explained>.75)return 'Most of this move is explained by things we can observe.';
  if(explained>.4)return `About ${Math.round(explained*100)}% of this move is explained. The rest is unaccounted for.`;
  if(trust<.33)return 'Almost none of this move is explained, and the volume behind it is thin.';
  return 'This move is not explained by market, sector or any news we can see — but real volume is behind it. Something may be known that we cannot observe.';
}
