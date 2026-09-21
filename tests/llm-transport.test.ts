import { it,expect } from 'vitest';
import { QwenClient } from '../api/_llm';
it('assembles fragmented OpenAI-compatible tool calls and text without an external request',async()=>{
  const lines=[{choices:[{delta:{tool_calls:[{index:0,id:'call-a',function:{name:'get_reckoning',arguments:'{"sym'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{arguments:'bol":"rNVDA"}'}}]}}]},{choices:[{delta:{content:'done'}}],usage:{total_tokens:25}}];
  const bytes=new TextEncoder().encode(lines.map(v=>'data: '+JSON.stringify(v)+'\n\n').join('')+'data: [DONE]\n\n');
  const transport:typeof fetch=async(_url,init)=>{expect(JSON.parse(String(init?.body)).max_tokens).toBe(1200);return new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=7)c.enqueue(bytes.slice(i,i+7));c.close();}}));};
  const client=new QwenClient('test-key','https://example.invalid','test-model',transport),chunks=[];
  for await(const chunk of client.complete({system:'research',messages:[],maxTokens:1200,temperature:.2,signal:new AbortController().signal}))chunks.push(chunk);
  expect(chunks).toContainEqual({type:'tool',call:{id:'call-a',name:'get_reckoning',arguments:'{"symbol":"rNVDA"}'}});expect(chunks).toContainEqual({type:'usage',tokens:25});
});
