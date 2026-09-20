export const scale=(lo:number,hi:number,start:number,end:number)=>(value:number):number=>start+(value-lo)/(hi-lo||1)*(end-start);
export const line=(points:Array<[number,number]>):string=>points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
export const ticks=(lo:number,hi:number,count=4):number[]=>Array.from({length:count},(_,i)=>lo+(hi-lo)*i/(count-1));
