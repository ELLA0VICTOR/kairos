import { Fragment,useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { useDesk } from '@/data/queries';
import { Button,Field,Panel } from '@/components/primitives';
import { RESEARCH_FOOTER,stripInlineDigits,type EngineFigure } from '../../engine/research';
import { decodeSse,offlineResearch,type ResearchEvent,type ResearchResult } from '@/research/stream';

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
const examples=['I want to buy rNVDA tonight. Talk me out of it.','Compare rAMD and rNVDA. Which move is more trustworthy?','What is the risk of holding rTSLA through the next open?'];
export default function Ask(){
  const {data}=useDesk(),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[steps,setSteps]=useState<Array<{label:string;ms:number}>>([]),[prose,setProse]=useState(''),[result,setResult]=useState<ResearchResult|null>(null),[error,setError]=useState<string|null>(null);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  async function submit(value=question){
    if(!value.trim()||busy)return;
    active.current?.abort();const controller=new AbortController();active.current=controller;
    setQuestion(value);setBusy(true);setSteps([]);setProse('');setResult(null);setError(null);
    let done=false;
    const consume=async(events:AsyncIterable<ResearchEvent>)=>{for await(const event of events){if(controller.signal.aborted)return;
      if(event.type==='step')setSteps(items=>[...items,event.data]);
      if(event.type==='prose')setProse(text=>text+event.data.delta);
      if(event.type==='done'){done=true;setResult(event.data);}
      await new Promise<void>(resolve=>setTimeout(resolve,8));
    }};
    const network=new AbortController(),deadline=setTimeout(()=>network.abort(),48000);
    try {
      const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:value}),signal:AbortSignal.any([controller.signal,network.signal])});
      if(response.status===429){setError(await response.text());return;}
      await consume(decodeSse(response));if(!done)throw new Error('Incomplete research stream');
    }catch{
      if(!controller.signal.aborted){setSteps([]);setProse('');setError('Using saved data for offline research.');await consume(offlineResearch(value,data));}
      else if(active.current===controller)setError('Research stopped. Submit again to use the saved snapshot.');
    }finally{clearTimeout(deadline);if(active.current===controller)setBusy(false);}
  }
  const figures=result?.figures;
  return <div className="instrument-view">
    <header className="page-heading"><div><p className="eyebrow">Research</p><h1>Ask Kairos</h1><p className="company-name">Engine figures. Reasoned answers.</p></div><Link className="button quiet" to="/">Back to markets</Link></header>
    <p className="panel-prose">Kairos runs the research and writes up what it found. Every number comes from the engine. Only the reasoning is written by the model when it is available.</p>
    <Panel title="What would you like to understand?">
      <form className="flex flex-col gap-4" onSubmit={event=>{event.preventDefault();void submit();}}><Field label="Your research question"><input style={{background:'var(--surface)',color:'var(--bone)',border:'1px solid var(--rule)',padding:'12px',width:'100%'}} aria-label="Your research question" maxLength={1500} value={question} onChange={event=>setQuestion(event.target.value)} placeholder="What is behind the move in rNVDA?" disabled={busy}/></Field><Button className="self-start" variant="primary" type="submit" disabled={busy||!question.trim()}>{busy?'Researching…':'Research'}</Button></form>
      <div className="instrument-actions">{examples.map(example=><Button key={example} style={{whiteSpace:'normal',textAlign:'left',maxWidth:'100%'}} variant="quiet" disabled={busy} onClick={()=>void submit(example)}>{example}</Button>)}</div>
      <p className="micro-note">Questions stay in this session. Portfolio details are not stored or sent to the language provider.</p>
    </Panel>
    {error&&<p role="status" className="notice">{error}</p>}
    {(busy||steps.length>0)&&<Panel title="Research log"><ol aria-live="polite">{steps.map((step,i)=><li key={i}>{step.label} <span className="micro-note">{step.ms} ms</span></li>)}</ol>{busy&&<p role="status" className="micro-note">Reading the engine and preparing the note…</p>}</Panel>}
    {(prose||result)&&<article data-research-note aria-busy={busy}>
      <Panel title={result?.note.title??'The evidence so far'}><p className="micro-note" data-language-mode={result?.mode}>{result?.label??'Checking the evidence before resolving figures.'}</p>{result?.notice&&<p role="status" className="notice">{result.notice}</p>}
        {(result?.note.paragraphs??prose.split('\n\n').filter(Boolean)).map((paragraph,i)=><p key={i} className="panel-prose" data-generated-prose><ResearchProse text={paragraph} figures={figures}/></p>)}
        {result&&<p className="micro-note" data-generated-prose>Confidence: {result.note.confidence}. <ResearchProse text={result.note.confidenceReason} figures={figures}/></p>}
      </Panel>
      {result&&<Panel title="Recommendation"><dl className="grid gap-4" data-recommendation>
        <div><dt>Position ceiling</dt><dd><ResearchProse text="{{fig:sizeCeiling}}" figures={figures}/> of account. No allocation is justified.</dd></div>
        <div><dt>Invalidated if</dt><dd data-generated-prose><ResearchProse text={result.note.recommendation.invalidatedIf} figures={figures}/></dd></div>
        <div><dt>Watch for</dt><dd data-generated-prose><ResearchProse text={result.note.recommendation.watchFor} figures={figures}/></dd></div>
        <div><dt>Resolves at</dt><dd><ResearchProse text="{{fig:nextOpen}}" figures={figures}/></dd></div>
      </dl><p className="micro-note">Research uses the saved snapshot from {new Date(result.asOf).toUTCString()}. <Link to="/record">Inspect the record</Link></p></Panel>}
    </article>}
    <p className="micro-note">{RESEARCH_FOOTER}</p>
  </div>;
}
