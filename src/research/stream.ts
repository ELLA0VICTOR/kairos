import { FALLBACK_LABEL,parseIntent,resolveFigure,templateResearchNote,validateResearchNote,type EngineFigure,type EngineSnapshot,type ResearchNote } from '../../engine/research.js';
import { researchPlan,runTool } from '../../engine/research-tools.js';
export interface ResearchUsage {inputTokens:number;outputTokens:number;cachedInputTokens:number;totalTokens:number;completions:number}
export interface ResearchResult {note:ResearchNote;figures:EngineFigure[];mode:'none'|'qwen'|'openai';label:string;asOf:number;partial:boolean;notice?:string;usage?:ResearchUsage}
export type ResearchEvent={type:'step';data:{label:string;ms:number}}|{type:'prose';data:{delta:string}}|{type:'done';data:ResearchResult};
export function researchResult(note:ResearchNote,data:EngineSnapshot,mode:ResearchResult['mode']='none',notice?:string):ResearchResult {
  const checked=validateResearchNote(note,data);
  return {note:checked,figures:checked.figures.map(ref=>resolveFigure(ref,data)),mode,label:mode==='none'?FALLBACK_LABEL:`Written with ${mode==='qwen'?'Qwen':'OpenAI'}. Every figure comes from the engine.`,asOf:data.snapshot.ts,partial:false,notice};
}
export async function* noteEvents(result:ResearchResult):AsyncGenerator<ResearchEvent>{
  for(const paragraph of result.note.paragraphs){
    // Stream only validated prose. Never expose raw model deltas or a partial figure token.
    for(const delta of paragraph.match(/\{\{fig:[^}]+\}\}|[^{}\s]+\s*|\s+/g)??[])yield {type:'prose',data:{delta}};
    yield {type:'prose',data:{delta:'\n\n'}};
  }
  yield {type:'done',data:result};
}
export async function* offlineResearch(question:string,data:EngineSnapshot):AsyncGenerator<ResearchEvent>{
  const intent=parseIntent(question,data);
  for(const call of researchPlan(intent,data)){
    const start=performance.now();runTool(call,data);
    yield {type:'step',data:{label:`Read ${call.name.replace('get_','').replaceAll('_',' ')}${call.args.symbol?` for ${String(call.args.symbol)}`:''}`,ms:Math.round(performance.now()-start)}};
  }
  yield* noteEvents(researchResult(templateResearchNote(intent,data),data));
}
export async function* decodeSse(response:Response):AsyncGenerator<ResearchEvent>{
  if(!response.ok||!response.headers.get('content-type')?.includes('text/event-stream')||!response.body)throw new Error('Research service unavailable');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  try {while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r\n/g,'\n');let boundary:number;
    while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const type=block.match(/^event: (.+)$/m)?.[1],raw=block.match(/^data: (.+)$/m)?.[1];if(raw&&['step','prose','done'].includes(type??''))yield {type,data:JSON.parse(raw) as unknown} as ResearchEvent;}
    if(done)break;
  }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
