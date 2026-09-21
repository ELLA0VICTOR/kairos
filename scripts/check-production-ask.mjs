import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.KAIROS_CHECK_URL??'https://kairos-x-nu.vercel.app';
const started=performance.now();
const response=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Talk me out of buying rNVDA'}),signal:AbortSignal.timeout(60000)});
assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
let content='',chunks=0,firstChunkMs;
for await(const chunk of response.body){firstChunkMs??=performance.now()-started;content+=new TextDecoder().decode(chunk);chunks++;}
const events=content.split('\n\n').filter(x=>x.startsWith('event:')).map(x=>({type:x.match(/^event: (.+)/)[1],data:JSON.parse(x.match(/\ndata: (.+)/)[1])}));
const done=events.find(e=>e.type==='done');assert.ok(done,'complete research result');
const steps=events.filter(e=>e.type==='step').length;
assert.ok(steps<=6);assert.ok(chunks>1);
const prose=events.filter(e=>e.type==='prose').map(e=>e.data.delta).join('');
assert.doesNotMatch(prose.replace(/\{\{fig:[^}]+\}\}/g,''),/\d/);
const names=new Set(done.data.figures.map(f=>f.name));
for(const match of prose.matchAll(/\{\{fig:([^}]+)\}\}/g))assert.ok(names.has(match[1]),'resolved figure '+match[1]);
const result={url:base,checkedAt:new Date().toISOString(),mode:done.data.mode,elapsedMs:Math.round(performance.now()-started),firstChunkMs:Math.round(firstChunkMs),chunks,steps,usage:done.data.usage,notice:done.data.notice,partial:done.data.partial,proseFigureReferencesValid:true};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/production-ask.json',JSON.stringify({result,events},null,2));
console.log(JSON.stringify(result,null,2));
