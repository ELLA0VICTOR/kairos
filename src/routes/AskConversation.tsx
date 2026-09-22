import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useDesk} from '@/data/queries';
import {BrandMark,Icon} from '@/components/primitives/Icon';
import {RESEARCH_FOOTER} from '../../engine/research';
import {decodeSse,offlineResearch,type ResearchEvent,type ResearchResult} from '@/research/stream';
import {contextualQuestion} from '@/research/conversation';
import {ResearchProse} from '../research/ResearchProse';
type Turn={id:number;question:string;steps:Array<{label:string;ms:number}>;prose:string;result?:ResearchResult;status:'working'|'done'|'stopped'|'error';notice?:string};
const examples=[['Understand a move','What is behind the move in rNVDA?'],['Compare the evidence','Compare rAMD and rNVDA. Which move is more trustworthy?'],['Pressure-test a position','What is the risk of holding rTSLA through the next open?']];
export default function AskConversation(){
 const {data}=useDesk(),[question,setQuestion]=useState(''),[turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false),[context,setContext]=useState<string[]>([]);
 const active=useRef<AbortController|null>(null),counter=useRef(0),input=useRef<HTMLTextAreaElement>(null),latest=useRef<HTMLElement>(null),lock=useRef(false);
 useEffect(()=>()=>active.current?.abort(),[]);
 const update=(id:number,fn:(turn:Turn)=>Turn)=>setTurns(all=>all.map(t=>t.id===id?fn(t):t));
 async function submit(value=question){
  if(!value.trim()||lock.current)return;lock.current=true;setBusy(true);
  const controller=new AbortController(),id=++counter.current;active.current=controller;
  const scoped=contextualQuestion(value.trim(),context,data.universe);setContext(scoped.symbols);
  setTurns(all=>[...all,{id,question:value.trim(),steps:[],prose:'',status:'working'}]);setQuestion('');
  requestAnimationFrame(()=>latest.current?.scrollIntoView({block:'start',behavior:'instant'}));
  let done=false;
  const consume=async(events:AsyncIterable<ResearchEvent>)=>{for await(const event of events){
   if(controller.signal.aborted)return;
   if(event.type==='step')update(id,t=>({...t,steps:[...t.steps,event.data]}));
   if(event.type==='prose')update(id,t=>({...t,prose:t.prose+event.data.delta}));
   if(event.type==='done'){done=true;update(id,t=>({...t,result:event.data,status:'done'}));}
  }};
  const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),48000);
  try{
   const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:scoped.question}),signal:AbortSignal.any([controller.signal,timeout.signal])});
   if(response.status===429){update(id,t=>({...t,status:'error',notice:'Research limit reached. Please return in an hour; the market board is still available.'}));return;}
   await consume(decodeSse(response));if(!done)throw new Error('Incomplete stream');
  }catch{
   if(!controller.signal.aborted){
    update(id,t=>({...t,steps:[],prose:'',notice:'Connection unavailable. Researching the available snapshot.'}));
    try{await consume(offlineResearch(scoped.question,data));}catch{update(id,t=>({...t,status:'error',notice:'Research could not finish. Try a covered instrument such as rNVDA.'}));}
   }else update(id,t=>({...t,status:'stopped',notice:'Stopped. Send a new question when you are ready.'}));
  }finally{clearTimeout(timer);if(active.current===controller){lock.current=false;setBusy(false);active.current=null;input.current?.focus();}}
 }
 function clear(){active.current?.abort();active.current=null;lock.current=false;setBusy(false);setTurns([]);setContext([]);setQuestion('');input.current?.focus();}
 return <div className="ask-agent">
  <header className="agent-header"><div><span className="eyebrow">Kairos / Research</span><h1>A clearer read.</h1><p>Ask about the move. Follow the evidence.</p></div><button className="button quiet" onClick={clear} disabled={!turns.length}>New conversation</button></header>
  {!turns.length&&<section className="agent-welcome" aria-label="Start a research conversation"><div className="agent-emblem"><BrandMark/></div><h2>What are you watching?</h2><p>A name, a dislocation, or a reason to wait.</p><div className="agent-examples">{examples.filter(([,q])=>!data.universe.some(i=>q!.includes(i.symbol)&&data.params.instruments[i.symbol]?.estimateStability==='unstable')).map(([label,q])=><button key={label} onClick={()=>void submit(q)}><span>{label}</span><Icon name="arrow"/><small>{q}</small></button>)}</div></section>}
  <div className="agent-thread" aria-label="Research conversation">
   {turns.map((turn,index)=><section className="agent-turn" key={turn.id} ref={index===turns.length-1?latest:null}>
    <div className="agent-question"><span>You</span><p>{turn.question}</p></div>
    <article className="agent-answer" data-research-note aria-busy={turn.status==='working'}>
     <header><span className="agent-avatar"><BrandMark/></span><strong>Kairos</strong><span className="agent-state" role="status">{turn.status==='working'?'Researching':turn.status==='done'?'Research complete':turn.status==='stopped'?'Stopped':'Unavailable'}</span></header>
     {(turn.steps.length>0||turn.status==='working')&&<details className="agent-log" open={turn.status==='working'}><summary>{turn.status==='working'?'Following the evidence':`${turn.steps.length} research steps`}<span className={turn.status==='working'?'agent-pulse':''}/></summary><ol>{turn.steps.map((s,i)=><li key={i}><span>{s.label}</span><small>{s.ms} ms</small></li>)}</ol>{turn.status==='working'&&<p>Reading the engine and checking the response…</p>}</details>}
     {turn.notice&&<p className="agent-notice" role="status">{turn.notice}</p>}
     {turn.result&&<p className="agent-provenance" data-language-mode={turn.result.mode}>{turn.result.mode==='none'?'Engine-backed answer · language model unavailable':`Written with ${turn.result.mode==='qwen'?'Qwen':'OpenAI'} · engine-backed figures`}</p>}
     {turn.result?.notice&&<p className="agent-notice">{turn.result.notice}</p>}
     {(turn.result?.note.paragraphs??turn.prose.split('\n\n').filter(Boolean)).map((p,i)=><p key={i} data-generated-prose className="agent-prose"><ResearchProse text={p} figures={turn.result?.figures}/></p>)}
     {turn.result&&<><details className="agent-conclusion" open><summary>What to watch next</summary><dl data-recommendation><div><dt>Invalidation</dt><dd data-generated-prose><ResearchProse text={turn.result.note.recommendation.invalidatedIf} figures={turn.result.figures}/></dd></div><div><dt>Watch for</dt><dd data-generated-prose><ResearchProse text={turn.result.note.recommendation.watchFor} figures={turn.result.figures}/></dd></div><div><dt>Next bell</dt><dd><ResearchProse text="{{fig:nextOpen}}" figures={turn.result.figures}/></dd></div><div><dt>Position ceiling</dt><dd><ResearchProse text="{{fig:sizeCeiling}}" figures={turn.result.figures}/> of account. No allocation is justified.</dd></div></dl></details><p className="agent-provenance" data-generated-prose>Confidence: {turn.result.note.confidence}. <ResearchProse text={turn.result.note.confidenceReason} figures={turn.result.figures}/></p><p className="agent-provenance">Snapshot {new Date(turn.result.asOf).toUTCString()} · <Link to="/record">View the record</Link></p></>}
    </article>
   </section>)}
  </div>
  <div className="agent-composer-wrap"><form className="agent-composer" onSubmit={e=>{e.preventDefault();void submit();}}>
   <label htmlFor="agent-question" className="sr-only">Your research question</label>
   {context.length>0&&<div className="agent-context">Following {context.join(' + ')}<button type="button" onClick={()=>setContext([])} aria-label="Clear instrument context">×</button></div>}
   <textarea ref={input} id="agent-question" aria-label="Your research question" rows={2} maxLength={1400} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={turns.length?'Ask a follow-up, or name another instrument…':'Ask Kairos about an instrument…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void submit();}}}/>
   <div className="agent-composer-bottom"><small>Engine figures. No orders. <span>Enter to send · Shift + Enter for a new line</span></small>{busy?<button type="button" className="agent-send" onClick={()=>active.current?.abort()} aria-label="Stop research">Stop</button>:<button type="submit" className="agent-send" disabled={!question.trim()} aria-label="Send research question"><Icon name="arrow"/></button>}</div>
  </form><p className="agent-privacy">Conversation stays on this page. Follow-ups retain instrument context, not prior model claims.</p></div>
  <p className="agent-disclaimer">{RESEARCH_FOOTER}</p>
 </div>;
}
