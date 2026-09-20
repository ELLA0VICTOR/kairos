import {browser,check,sleep} from './browser-kit.mjs';
const b=await browser();
try{
 await b.call('Network.setBlockedURLs',{urls:['https://*','http://127.0.0.1:5173/data/*']});
 for(const width of [390,768,1280,1920]){
  await b.navigate('/instrument/rTSLA?at=2026-09-20T20:00:00Z',width);
  check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`),`instrument has no overflow at ${width}`);
  check(await b.evaluate(`document.querySelectorAll('.instrument-grid>.panel').length===7`),`all seven panels render offline at ${width}`);
  check(await b.evaluate(`document.querySelectorAll('.analog-outcome').length===80`),'80 individual analog dots at the bell');
  check(await b.evaluate(`document.querySelectorAll('.instrument-view table.sr-only').length===4`),'every instrument chart has its data table');
  if(width<1024)check(await b.evaluate(`getComputedStyle(document.querySelector('.instrument-grid')).gridTemplateColumns.split(' ').length===1`),'panels reflow in one column');
  await b.capture(`phase-6-instrument-${width}`);
 }
 check(await b.evaluate(`document.querySelector('[data-component=unaccounted]').getAttribute('fill')==='none'`),'unaccounted bar is hollow');
 check(await b.evaluate(`(()=>{const v=Object.fromEntries([...document.querySelectorAll('[data-component]')].map(e=>[e.dataset.component,Number(e.dataset.value)]));return Math.abs(v.market+v.sector+v.news+v.unaccounted-v.total)<1e-12})()`),'waterfall components sum to the total');
 await b.evaluate(`window.instrumentNode=document.querySelector('.instrument-view');const s=document.querySelector('select[aria-label=Instrument]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'rNVDA');s.dispatchEvent(new Event('change',{bubbles:true}));`);await sleep(1800);
 check(await b.evaluate(`window.instrumentNode===document.querySelector('.instrument-view')&&document.querySelector('h1').textContent.includes('rNVDA')&&!document.querySelector('.intro')`),'symbol switch preserves the page and does not replay entrance motion');
 await b.evaluate(`document.querySelector('.instrument-actions button').click()`);await sleep(300);
 check(await b.evaluate(`document.querySelector('[role=status]').textContent.includes('Fix logged locally')&&JSON.parse(localStorage.getItem('kairos.local-fixes')).some(f=>f.symbol==='rNVDA'&&f.status==='open')`),'local fix is saved with explicit public-ledger disclosure');
 await b.navigate('/instrument/rTSLA?at=2026-09-23T05:00:00Z');
 check(await b.evaluate(`document.querySelectorAll('.instrument-view table.sr-only').length===4`),'overnight fixture renders all four charts');
 check(!b.errors.length,'no browser exceptions');
}finally{b.close();}
