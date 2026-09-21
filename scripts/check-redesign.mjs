import {browser,check,sleep} from './browser-kit.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const b=await browser();
try{
 await b.call('Network.setBlockedURLs',{urls:[]});
 await mkdir('artifacts/screenshots',{recursive:true});
 for(const width of [1440,390]){
  for(const [name,path] of [['overview','/'],['instrument','/instrument/rTSLA'],['record','/record']]){
   await b.navigate(path+'?at=2026-09-20T20:00:00Z',width);
   check(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),`${name} fits ${width}px`);
   const result=await b.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   await writeFile(`artifacts/screenshots/redesign-${name}-${width}.png`,Buffer.from(result.data,'base64'));
  }
 }
 await b.navigate('/?at=2026-09-20T20:00:00Z',1440);
 check(await b.evaluate(`document.querySelectorAll('a.board-row').length===18`),'default board shows 18 stocks');
 await b.evaluate(`const input=document.querySelector('[aria-label="Find an instrument"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Tesla');input.dispatchEvent(new Event('input',{bubbles:true}));`);await sleep(150);
 check(await b.evaluate(`document.querySelectorAll('a.board-row').length===1&&document.querySelector('a.board-row').textContent.includes('rTSLA')`),'search finds a company');
 await b.evaluate(`document.querySelector('[aria-label="Clear search"]').click();`);await sleep(100);
 await b.evaluate(`[...document.querySelectorAll('.filter-tabs button')].find(b=>b.textContent.includes('Market anchors')).click()`);await sleep(100);
 check(await b.evaluate(`document.querySelectorAll('a.board-row').length===2`),'market anchor filter works');
 check(!b.errors.length,'no browser exceptions');
}finally{b.close();}
