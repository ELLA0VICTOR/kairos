import { reserveLanguageBudget,reconcileLanguageBudget } from './_guards.js';
export interface ToolSpec { name:string; description:string; parameters:Record<string,unknown> }
export interface ToolCall { id:string; name:string; arguments:string }
export interface Message { role:'user'|'assistant'|'tool'; content:string|null; tool_call_id?:string; tool_calls?:Array<{id:string;type:'function';function:{name:string;arguments:string}}> }
export type LlmChunk = {type:'text';delta:string}|{type:'tool';call:ToolCall}|{type:'usage';tokens:number;inputTokens?:number;outputTokens?:number;cachedInputTokens?:number};
export interface LlmClient {
  readonly id:'qwen'|'openai'|'none';
  complete(args:{system:string;messages:Message[];tools?:ToolSpec[];maxTokens:number;temperature:number;signal:AbortSignal}):AsyncIterable<LlmChunk>;
}
export const noneClient:LlmClient={id:'none',async *complete(){return;}};
export class LanguageBudgetPaused extends Error {}
class ChatCompletionsClient implements LlmClient {
  constructor(readonly id:'qwen'|'openai',private readonly key:string,private readonly base:string,private readonly model:string,private readonly transport:typeof fetch=fetch){}
  async *complete(args:Parameters<LlmClient['complete']>[0]):AsyncIterable<LlmChunk>{
    const response=await this.transport(this.base.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},signal:args.signal,body:JSON.stringify({model:this.model,messages:[{role:'system',content:args.system},...args.messages],tools:args.tools?.map(tool=>({type:'function',function:tool})),max_tokens:args.maxTokens,temperature:args.temperature,stream:true,stream_options:{include_usage:true}})});
    if(!response.ok||!response.body)throw new Error('Language gateway unavailable');
    const reader=response.body.getReader(),decoder=new TextDecoder(),calls=new Map<number,ToolCall>();let buffer='',bytes=0;
    const parse=(line:string):LlmChunk[]=>{
      if(!line.startsWith('data:'))return [];const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')return [];
      const message=JSON.parse(raw) as {choices?:Array<{delta?:{content?:string;tool_calls?:Array<{index:number;id?:string;function?:{name?:string;arguments?:string}}>}}>;usage?:{total_tokens:number;prompt_tokens?:number;completion_tokens?:number;prompt_tokens_details?:{cached_tokens?:number}};error?:unknown};
      if(message.error)throw new Error('Language stream error');const chunks:LlmChunk[]=[];
      for(const choice of message.choices??[]){const d=choice.delta;if(typeof d?.content==='string')chunks.push({type:'text',delta:d.content});
        for(const fragment of d?.tool_calls??[]){if(!Number.isInteger(fragment.index)||fragment.index<0||fragment.index>5)throw new Error('Tool count exceeded');const call=calls.get(fragment.index)??{id:'',name:'',arguments:''};call.id+=fragment.id??'';call.name+=fragment.function?.name??'';call.arguments+=fragment.function?.arguments??'';calls.set(fragment.index,call);}}
      if(message.usage&&Number.isFinite(message.usage.total_tokens))chunks.push({type:'usage',tokens:message.usage.total_tokens,...(message.usage.prompt_tokens!==undefined?{inputTokens:message.usage.prompt_tokens,outputTokens:message.usage.completion_tokens??0,cachedInputTokens:message.usage.prompt_tokens_details?.cached_tokens??0}:{})});return chunks;
    };
    try {
      while(true){const {done,value}=await reader.read();bytes+=value?.length??0;if(bytes>512000)throw new Error('Language stream too large');buffer+=decoder.decode(value,{stream:!done});let newline:number;
        while((newline=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,newline).replace(/\r$/,'');buffer=buffer.slice(newline+1);yield* parse(line);}
        if(done){if(buffer.trim())yield* parse(buffer);break;}
      }
      for(const call of calls.values()){if(!call.id||!call.name)throw new Error('Incomplete tool call');yield {type:'tool',call};}
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
}
export class QwenClient extends ChatCompletionsClient {
  constructor(key:string,base='https://hackathon.bitgetops.com/v1',model='qwen3.8-max',transport:typeof fetch=fetch){super('qwen',key,base,model,transport);}
}
export class OpenAiClient extends ChatCompletionsClient {
  constructor(key:string,model='gpt-4o-mini',transport:typeof fetch=fetch){super('openai',key,'https://api.openai.com/v1',model,transport);}
}
export function getLlmClient():LlmClient {
  const qwen=process.env.QWEN_API_KEY?.trim(),openai=process.env.OPENAI_API_KEY?.trim();
  const client=qwen?new QwenClient(qwen,process.env.QWEN_BASE_URL,process.env.QWEN_MODEL):openai?new OpenAiClient(openai,process.env.OPENAI_MODEL?.trim()||'gpt-4o-mini'):noneClient;
  if(client.id==='none')return client;
  return {id:client.id,async *complete(args){
    // UTF-8 bytes conservatively overestimate prompt tokens; reserve every round, including retries.
    const promptBytes=Buffer.byteLength(JSON.stringify({system:args.system,messages:args.messages,tools:args.tools}),'utf8');
    const reservation=promptBytes+args.maxTokens+512,reservedAt=Date.now();
    if(!reserveLanguageBudget(reservation,reservedAt))throw new LanguageBudgetPaused('Language service paused for today. Figures are unaffected.');
    let actual:number|undefined;
    try {for await(const chunk of client.complete(args)){if(chunk.type==='usage')actual=chunk.tokens;yield chunk;}}
    finally{if(actual!==undefined)reconcileLanguageBudget(reservation,actual,reservedAt);}
  }};
}
