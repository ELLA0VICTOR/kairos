import { browser,check,sleep } from './browser-kit.mjs';
const b=await browser();
try {
 await b.call('Network.setBlockedURLs',{urls:['https://*','http://127.0.0.1:5173/data/*']});
 for(const width of [390,768,1280,1920]){
  await b.navigate('/?at=2026-09-20T20:00:00Z',width);
  check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`),`no overflow at ${width}`);
  check(await b.evaluate(`document.querySelectorAll('a.board-row').length===20`),`20 rows with artifact network disabled at ${width}`);
  await b.capture(`phase-5-board-${width}`);
 }
 await b.evaluate(`document.querySelector('.board-head button').focus()`);
 await b.call('Page.bringToFront');
 await b.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await b.call('Input.dispatchKeyEvent',{type:'char',text:'\r',key:'Enter',windowsVirtualKeyCode:13});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await sleep(300);
 check(await b.evaluate(`document.querySelector('[aria-sort]').textContent.includes('Price')`),'keyboard sorting changes the announced column');
 await b.evaluate(`document.querySelector('a[href="/method"]').click()`);await sleep(300);await b.evaluate(`document.querySelector('nav a[href="/"]').click()`);await sleep(300);
 check(await b.evaluate(`!document.querySelector('.session-bar.intro')`),'entrance sequence does not replay on route return');
 await b.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await b.navigate('/?at=2026-09-22T16:00:00Z');
 check(await b.evaluate(`document.querySelector('main').textContent.includes('Reckoning is paused')`),'regular-session branch is explicit');
 check(await b.evaluate(`!document.querySelector('.session-bar.intro')`),'reduced motion disables entrance sequence');
 await b.call('Emulation.setEmulatedMedia',{features:[]});
 await b.navigate('/?at=2026-09-20T20:00:00Z');
 await b.call('Profiler.enable');await b.call('Profiler.start');
 const timing=await b.evaluate(`new Promise(resolve=>{const deltas=[];let last=performance.now(),start=last;function frame(t){deltas.push(t-last);last=t;if(t-start<32000)requestAnimationFrame(frame);else{const sorted=deltas.slice(1).sort((a,b)=>a-b);resolve({frames:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),over50:sorted.filter(d=>d>50).length});}}requestAnimationFrame(frame);})`);
 const profile=await b.call('Profiler.stop');
 const {writeFile}=await import('node:fs/promises');await writeFile('artifacts/phase-5-poll.cpuprofile',JSON.stringify(profile.profile));
 console.log('32-second quote-poll frame timing',timing);
 check(timing.p95<20,'95th-percentile frame time supports 60fps');
 check(!b.errors.length,'no browser exceptions');
}finally{b.close();}

