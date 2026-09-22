import {Fragment} from 'react';
import {stripInlineDigits,type EngineFigure} from '../../engine/research';

function figureText(f:EngineFigure):string {
  if(f.value===null)return 'Unavailable';
  if(f.format==='price')return '$'+f.value.toFixed(2);
  if(f.format==='time')return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(f.value);
  if(f.format==='count')return f.value.toLocaleString('en-US');
  return ((f.format==='logPercent'?Math.expm1(f.value):f.value)*100).toFixed(1)+'%';
}
export function ResearchProse({text,figures}:{text:string;figures?:EngineFigure[]}){
  return <>{stripInlineDigits(text).split(/(\{\{fig:[A-Za-z][A-Za-z0-9_]*\}\})/g).map((part,index)=>{
    const name=part.match(/^\{\{fig:([^}]+)\}\}$/)?.[1];if(!name)return <Fragment key={index}>{part}</Fragment>;
    const f=figures?.find(item=>item.name===name);
    return f?<span key={index} style={{display:'inline-block',border:'1px solid var(--rule)',padding:'2px 6px',fontSize:'.85em'}} data-engine-figure={name} title={f.source}><strong>{figureText(f)}</strong> <small className="micro-note">from the engine</small></span>:<span key={index} style={{border:'1px solid var(--rule)',padding:'2px 12px'}} aria-label="Resolving engine figure">—</span>;
  })}</>;
}
