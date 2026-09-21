import {browser,check,sleep} from './browser-kit.mjs';
const b=await browser();
async function waitDone(){for(let i=0;i<150;i++){if(await b.evaluate(`!!document.querySelector('[data-recommendation]')`))return;await sleep(100);}throw new Error('Research did not finish');}
async function inspect(){
 check(await b.evaluate(`document.querySelector('[data-language-mode]').dataset.languageMode==='none'`),'fallback is honestly labelled');
 check(await b.evaluate(`document.querySelectorAll('[data-engine-figure]').length>4`),'figures resolve to engine components');
 check(await b.evaluate(`[...document.querySelectorAll('[data-generated-prose]')].every(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('[data-engine-figure]').forEach(n=>n.remove());return !/\\p{N}/u.test(copy.textContent)&&!copy.textContent.includes('{{fig:');})`),'rendered prose contains no numeric claims outside engine components');
 check(await b.evaluate(`document.querySelectorAll('[data-recommendation] dt').length===4`),'recommendation includes all four fields');
 check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`),'Ask fits the viewport');
}
try{
 await b.navigate('/ask',1440);
 await b.evaluate(`document.querySelector('.instrument-actions button').click()`);
 await sleep(400);
 check(await b.evaluate(`!!document.querySelector('[aria-live="polite"] li')&&!document.querySelector('[data-recommendation]')`),'research log appears before the recommendation');
 await waitDone();await inspect();await b.capture('ask-fallback-1440');
 await b.navigate('/ask',390);await b.evaluate(`document.querySelector('.instrument-actions button').click()`);await waitDone();await inspect();await b.capture('ask-fallback-390');
 await b.call('Network.setBlockedURLs',{urls:['*/api/ask']});
 await b.evaluate(`document.querySelectorAll('.instrument-actions button')[2].click()`);await waitDone();await inspect();
 check(await b.evaluate(`document.body.textContent.includes('offline research')`),'missing endpoint uses bundled offline research');
 check(b.errors.length===0,'no browser exceptions');
}finally{await b.call('Network.setBlockedURLs',{urls:[]});b.close();}
