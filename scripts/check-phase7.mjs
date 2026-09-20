import {browser,check,sleep} from './browser-kit.mjs';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const b=await browser();
const select=async(label,value)=>{await b.evaluate(`(()=>{const s=document.querySelector('select[aria-label="${label}"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${value}');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(250);};
try{
 await b.call('Network.setBlockedURLs',{urls:['https://*','http://127.0.0.1:5173/data/*']});
 for(const width of [390,768,1280,1920]){
  await b.navigate('/record?at=2026-09-20T20:00:00Z',width);
  check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`),`Record has no page overflow at ${width}`);
  check(await b.evaluate(`document.querySelector('[aria-label="Live statistics"]').textContent.includes('0 resolved')&&document.querySelector('[aria-label="Backtest statistics"]').textContent.includes('60.9%')`),'live and backtest remain separate and the bad coverage is visible');
  check(await b.evaluate(`document.querySelector('table[aria-label="Open fixes"]').querySelectorAll('tr[data-fix-id]').length===7`),'seven pending forward fixes are visible');
  await select('Record origin','backtest');
  check(await b.evaluate(`document.querySelectorAll('.calibration table.sr-only tbody tr').length>0`),'calibration renders with its sample counts');
  check(await b.evaluate(`document.querySelector('table[aria-label="Resolved and void fixes"]').querySelectorAll('tr[data-fix-id]').length===50`),'ledger paginates at 50 rows');
  await b.capture(`phase-7-record-${width}`);
 }
 const first=await b.evaluate(`document.querySelector('[data-fix-id]').dataset.fixId`);
 await b.evaluate(`[...document.querySelectorAll('.pagination button')].find(b=>b.textContent==='Next').click()`);await sleep(200);
 check(await b.evaluate(`document.querySelector('[data-fix-id]').dataset.fixId!==${JSON.stringify(first)}`),'next page changes ledger rows');
 await select('Sector','consumer_growth');await select('Trust','thin');
 check(await b.evaluate(`document.querySelector('.pagination [role=status]').textContent.includes('Page 1 ')`),'changing filters resets pagination');
 await b.evaluate(`document.querySelector('[data-fix-id] button').click()`);await sleep(250);
 check(await b.evaluate(`(()=>{const pre=document.querySelector('.fix-detail pre'),f=JSON.parse(pre.textContent);return f.origin==='backtest'&&f.trust<.33&&f.inputsHash.length===64&&document.querySelector('.fix-detail.expanded').textContent.includes('not retained')})()`),'expanded row exposes valid raw JSON, version, hash and honest trust limitations');
 const folder=resolve('raw/downloads');await mkdir(folder,{recursive:true});await b.call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
 await b.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Download JSON').click()`);await sleep(1000);
 const exported=JSON.parse(await readFile(resolve(folder,'kairos-backtest-consumer_growth-thin-synthetic.json'),'utf8'));
 const artifact=JSON.parse(await readFile('public/data/ledger-backtest.json','utf8')),universe=JSON.parse(await readFile('public/data/universe.json','utf8'));
 const symbols=new Set(universe.data.filter(i=>i.sector==='consumer_growth').map(i=>i.symbol));
 const expected=artifact.data.filter(f=>symbols.has(f.symbol)&&f.trust<.33).sort((a,b)=>b.loggedAt-a.loggedAt||a.id.localeCompare(b.id));
 check(JSON.stringify(exported)===JSON.stringify(expected),'downloaded JSON exactly matches all active-filter records');
 check(!b.errors.length,'no browser exceptions');
}finally{b.close();}
