import { memo } from 'react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { bandWidth,pct } from '@/lib/format';
import type { Reckoning } from '@engine/types';
export const DriftCell=memo(function DriftCell({value,stale=false,intro=false,index=0}:{value:Reckoning;stale?:boolean;intro?:boolean;index?:number}){
  const {display,flash}=useAnimatedNumber(value.drift,{initial:intro,duration:intro?Math.max(140,500-index*18):280,delay:200+index*18});
  return <span className={`drift-cell ${flash?'value-flash':''} ${stale?'muted':Math.abs(value.drift)<.003?'muted':value.drift>0?'tone-rust':'tone-verdigris'}`}><span>{stale?'Stale':pct(display)}</span><small>{bandWidth(value.bandLow,value.bandHigh)}</small></span>;
});
