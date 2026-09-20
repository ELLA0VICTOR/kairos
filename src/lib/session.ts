import { HOUR, sessionWeight } from '@engine/calendar';
export function bandThickness(ts:number,end:number,regular=false):number {if(regular)return 28;if(end-ts<=HOUR)return 28;const w=sessionWeight(ts);return w===.12?6:w===.25?12:20;}
