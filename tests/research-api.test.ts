import { describe,it,expect } from 'vitest';
import { initialArtifacts } from '../src/data/artifacts';
import { research } from '../api/_research';
import { noneClient,type LlmClient } from '../api/_llm';
import { TOOLS,runTool } from '../engine/research-tools';
import { parseIntent,templateResearchNote } from '../engine/research';
import { rateAllowed,reserveLanguageBudget } from '../api/_guards';
import type { ResearchEvent } from '../src/research/stream';
const data=initialArtifacts;
async function collect(client:LlmClient=noneClient,timeoutMs=1000){const events:ResearchEvent[]=[];for await(const event of research('Talk me out of rNVDA',data,{client,timeoutMs}))events.push(event);return events;}
describe('research service boundaries',()=>{
  it('none mode emits actual tool steps, progressive prose and a complete final recommendation',async()=>{
    const events=await collect(),done=events.at(-1);expect(events[0]?.type).toBe('step');expect(events.filter(e=>e.type==='step')).toHaveLength(6);expect(events.filter(e=>e.type==='prose').length).toBeGreaterThan(10);
    expect(done?.type).toBe('done');if(done?.type==='done'){expect(done.data.mode).toBe('none');expect(done.data.note.recommendation.watchFor).toBeTruthy();}
  });
  it('exposes exactly the eight local engine tools and validates arguments',()=>{
    expect(TOOLS).toHaveLength(8);
    for(const name of ['get_reckoning','get_attribution','get_forecast','get_analogs'])expect(()=>runTool({name,args:{symbol:'rNVDA'}},data)).not.toThrow();
    expect(()=>runTool({name:'get_news',args:{symbols:['invalid']}},data)).toThrow();expect(()=>runTool({name:'get_board',args:{limit:-1}},data)).toThrow();
    expect(runTool({name:'get_track_record',args:{origin:'both'}},data)).toHaveProperty('live');
  });
  it('retries malformed final output once then falls back without leaking raw prose',async()=>{
    let calls=0;const client:LlmClient={id:'qwen',async *complete(){calls++;yield {type:'text',delta:'Buy 900 shares at 99.9 now'};}};
    const events=await collect(client);expect(calls).toBe(2);expect(JSON.stringify(events)).not.toContain('900');expect(events.at(-1)).toMatchObject({type:'done',data:{mode:'none'}});
  });
  it('stops a noncooperative upstream at the wall-clock cap and returns findings',async()=>{
    const client:LlmClient={id:'qwen',async *complete(){await new Promise(()=>{});}};
    const start=Date.now(),events=await collect(client,25);expect(Date.now()-start).toBeLessThan(500);
    expect(events.at(-1)).toMatchObject({type:'done',data:{partial:true,notice:'Research stopped at 45 seconds. Here is what was found.'}});
  });
  it('enforces the six-tool cap',async()=>{
    const client:LlmClient={id:'qwen',async *complete(){yield {type:'tool',call:{id:'session',name:'get_session',arguments:'{}'}};}};
    const events=await collect(client);expect(events.filter(e=>e.type==='step')).toHaveLength(6);expect(events.at(-1)).toMatchObject({type:'done',data:{mode:'none'}});
  });
  it('accepts only figures retrieved by tools, strips prose digits, and clamps model allocation',async()=>{
    let turn=0;
    const client:LlmClient={id:'qwen',async *complete(){
      if(!turn++){yield {type:'tool',call:{id:'r',name:'get_reckoning',arguments:'{"symbol":"rNVDA"}'}};yield {type:'tool',call:{id:'s',name:'get_session',arguments:'{}'}};return;}
      const n=templateResearchNote(parseIntent('rNVDA',data),data);
      yield {type:'text',delta:JSON.stringify({...n,title:'Price 123',paragraphs:['Current price is {{fig:price}}.'],figures:[{name:'price',kind:'price',symbol:'rNVDA'}],recommendation:{...n.recommendation,sizeCeilingPct:90}})};
    }};
    const events=await collect(client),done=events.at(-1);expect(done).toMatchObject({type:'done',data:{mode:'qwen',note:{title:'Price [unverified figure removed]',recommendation:{sizeCeilingPct:0}}}});
  });
  it('does not send portfolio text upstream and pauses language calls when budget is exhausted',async()=>{
    let called=false;const client:LlmClient={id:'qwen',async *complete(){called=true;}};
    for await(const _event of research('I own 400 rNVDA, my account is private',data,{client})){}expect(called).toBe(false);
    const events=[];for await(const e of research('rNVDA',data,{client,paused:true}))events.push(e);expect(called).toBe(false);expect(events.at(-1)).toMatchObject({data:{notice:'Language service paused for today. Figures are unaffected.'}});
  });
  it('limits requests and reserves daily language budget',()=>{
    const now=1900000000000;for(let i=0;i<20;i++)expect(rateAllowed('test-ip',now)).toBe(true);expect(rateAllowed('test-ip',now)).toBe(false);expect(rateAllowed('test-ip',now+3600000)).toBe(true);
    expect(reserveLanguageBudget(10,now,10)).toBe(true);expect(reserveLanguageBudget(1,now,10)).toBe(false);expect(reserveLanguageBudget(10,now+86400000,10)).toBe(true);
  });
});
