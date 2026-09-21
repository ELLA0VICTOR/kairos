import {browser,check,sleep} from './browser-kit.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await browser();
try{
 await b.navigate('/ask',1440);
 if(process.env.KAIROS_TEST_ORIGIN){await b.call('Page.navigate',{url:process.env.KAIROS_TEST_ORIGIN+'/ask'});await sleep(4000);}
 await b.evaluate(`(()=>{const original=window.fetch;window.__liveAudit={};window.fetch=async(...args)=>{const start=performance.now();const r=await original(...args);if(String(args[0]).includes('/api/ask')){r.clone().text().then(text=>{window.__liveAudit={text,elapsedMs:performance.now()-start};});}return r;};document.querySelector('.instrument-actions button').click();})()`);
 let streamed=false;
 for(let i=0;i<550;i++){const state=await b.evaluate(`({steps:document.querySelectorAll('[aria-live="polite"] li').length,done:!!document.querySelector('[data-recommendation]'),audit:!!window.__liveAudit.text})`);if(state.steps&&!state.done)streamed=true;if(state.done&&state.audit)break;await sleep(100);}
 const audit=await b.evaluate('window.__liveAudit');
 const events=(audit.text??'').split('\n\n').flatMap(block=>{const type=block.match(/^event: (.+)$/m)?.[1],raw=block.match(/^data: (.+)$/m)?.[1];return raw?[{type,data:JSON.parse(raw)}]:[];});
 const done=events.find(e=>e.type==='done')?.data,tools=events.filter(e=>e.type==='step'&&e.data.label.startsWith('Read '));
 await mkdir('artifacts/screenshots',{recursive:true});await writeFile('artifacts/ask-live-audit.json',JSON.stringify({elapsedMs:audit.elapsedMs,streamed,toolCalls:tools.length,steps:tools,done},null,2));
 console.log(JSON.stringify({mode:done?.mode,notice:done?.notice,elapsedMs:audit.elapsedMs,toolCalls:tools.length,usage:done?.usage}));
 check(done?.mode==='openai','real OpenAI answer, not template fallback');check(streamed,'research steps stream before final answer');check(tools.length>0&&tools.length<=6,'tool loop stays within six calls');check(audit.elapsedMs<45000,'request finishes within forty-five seconds');
 check(await b.evaluate(`[...document.querySelectorAll('[data-generated-prose]')].every(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('[data-engine-figure]').forEach(n=>n.remove());return !/\\p{N}/u.test(copy.textContent)&&!/\\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)\\b/i.test(copy.textContent)&&!copy.textContent.includes('{{fig:');})`),'live model prose contains no numeric figures or spelled-out numbers outside engine components');
 check(await b.evaluate(`document.querySelectorAll('[data-engine-figure]').length>2`),'engine references resolve in the DOM');
 await b.capture('ask-openai-live-1440');check(!b.errors.length,'no browser exceptions');
}finally{b.close();}
