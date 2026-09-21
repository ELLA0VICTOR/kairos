import { afterEach,it,expect,vi } from 'vitest';
import { getLlmClient,OpenAiClient } from '../api/_llm';
import { reserveLanguageBudget,reconcileLanguageBudget } from '../api/_guards';
afterEach(()=>vi.unstubAllEnvs());
it('reconciles completed reservations without refunding a different day',()=>{
  const now=2100000000000;
  expect(reserveLanguageBudget(900,now,1000)).toBe(true);
  reconcileLanguageBudget(900,100,now);
  expect(reserveLanguageBudget(900,now,1000)).toBe(true);
  expect(reserveLanguageBudget(1,now,1000)).toBe(false);
  expect(reserveLanguageBudget(1000,now+86400000,1000)).toBe(true);
  reconcileLanguageBudget(900,100,now);
  expect(reserveLanguageBudget(1,now+86400000,1000)).toBe(false);
});
it('selects none, OpenAI, and Qwen in the required priority',()=>{
  vi.stubEnv('QWEN_API_KEY','');vi.stubEnv('OPENAI_API_KEY','');expect(getLlmClient().id).toBe('none');
  vi.stubEnv('OPENAI_API_KEY','test-openai');expect(getLlmClient().id).toBe('openai');
  vi.stubEnv('QWEN_API_KEY','test-qwen');expect(getLlmClient().id).toBe('qwen');
});
it('uses the official endpoint, requested model and streamed usage',async()=>{
  const transport:typeof fetch=async(url,init)=>{expect(url).toBe('https://api.openai.com/v1/chat/completions');expect(JSON.parse(String(init?.body)).model).toBe('custom-model');return new Response('data: {"choices":[],"usage":{"prompt_tokens":200,"completion_tokens":30,"total_tokens":230,"prompt_tokens_details":{"cached_tokens":100}}}\n\ndata: [DONE]\n\n');};
  const chunks=[];for await(const c of new OpenAiClient('test','custom-model',transport).complete({system:'test',messages:[],maxTokens:1200,temperature:.2,signal:new AbortController().signal}))chunks.push(c);
  expect(chunks).toEqual([{type:'usage',tokens:230,inputTokens:200,outputTokens:30,cachedInputTokens:100}]);
});
