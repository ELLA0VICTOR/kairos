import { describe,it,expect } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import type { NewsItem } from '../engine/types';
import { classifyHeadline,classifyCachedNews } from '../scripts/classify-news';
import { noneClient,type LlmClient } from '../api/_llm';
import { aggregateNews } from '../engine/news';
const item:NewsItem={id:'news',ts:2000,headline:'Company raises guidance',source:'Test wire',url:null,symbols:['rNVDA'],category:'guidance',impact:null,impactConfidence:null,preAnchor:false};
describe('offline news classification',()=>{
  it('clamps valid impact, caps aggregation, floors uncertainty and excludes pre-anchor news',async()=>{
    const client:LlmClient={id:'qwen',async *complete(args){expect(args.maxTokens).toBe(300);expect(args.temperature).toBe(.2);yield {type:'text',delta:JSON.stringify({category:'guidance',marketWide:false,impacts:[{symbol:'rNVDA',impact:1,confidence:.8}],reasoning:'Material outlook change.'})};}};
    const value=await classifyHeadline(item,['rNVDA'],client);expect(value?.impacts[0]?.impact).toBe(.15);
    const news={...item,impact:value!.impacts[0]!.impact,impactConfidence:.8};
    expect(aggregateNews([news,news], 'rNVDA',1000,3000).impact).toBeCloseTo(.1*Math.tanh(3));
    expect(aggregateNews([{...news,impact:0}], 'rNVDA',1000,3000).uncertainty).toBe(.002);
    expect(aggregateNews([{...news,preAnchor:true}], 'rNVDA',1000,3000).impact).toBe(0);
  });
  it('retries invalid classification once then returns null rather than zero',async()=>{
    let calls=0;const client:LlmClient={id:'qwen',async *complete(){calls++;yield {type:'text',delta:'{"impact":0}'};}};
    expect(await classifyHeadline(item,['rNVDA'],client)).toBeNull();expect(calls).toBe(2);
  });
  it('permanently caches headline results and preserves synthetic news without calls',async()=>{
    const root=await mkdtemp(join(tmpdir(),'kairos-news-'));let calls=0;
    const client:LlmClient={id:'qwen',async *complete(){calls++;yield {type:'text',delta:JSON.stringify({category:'guidance',marketWide:false,impacts:[{symbol:'rNVDA',impact:.02,confidence:.7}],reasoning:'Guidance raised.'})};}};
    try {
      const first=await classifyCachedNews(root,[item],['rNVDA'],1000,client),second=await classifyCachedNews(root,[{...item,id:'repeat'}],['rNVDA'],3000,client);
      expect(calls).toBe(1);expect(first[0]?.impact).toBe(.02);expect(second[0]?.preAnchor).toBe(true);
      const synthetic={...item,source:'Kairos simulated wire',impact:.03,impactConfidence:1};
      expect((await classifyCachedNews(root,[synthetic],['rNVDA'],1000,client))[0]).toEqual(synthetic);expect(calls).toBe(1);
      expect((await classifyCachedNews(root,[{...item,headline:'Unclassified'}],['rNVDA'],1000,noneClient))[0]?.impact).toBeNull();
    }finally{if(dirname(resolve(root))!==resolve(tmpdir())||!root.includes('kairos-news-'))throw new Error('Unsafe test cleanup path');await rm(root,{recursive:true,force:true});}
  });
});
