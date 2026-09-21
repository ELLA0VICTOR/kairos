import {browser,check,sleep} from './browser-kit.mjs';
import {writeFile} from 'node:fs/promises';
const b=await browser();
const capture=async name=>{const shot=await b.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`artifacts/screenshots/${name}.png`,Buffer.from(shot.data,'base64'));};
try{
 await b.call('Network.setBlockedURLs',{urls:[]});
 await b.navigate('/?at=2026-09-20T20:00:00Z',1440);
 check(await b.evaluate(`!!document.querySelector('.earth-fallback.is-ready')`),'textured WebGL globe rendered');
 check(await b.evaluate(`document.querySelectorAll('.company-mark img').length===18&&[...document.querySelectorAll('.company-mark img')].every(i=>i.complete&&i.naturalWidth>0)`),'all stock logos loaded');
 check(await b.evaluate(`!document.querySelector('.sidebar')`),'no sidebar');
 await capture('orbital-overview-1440');
 await b.evaluate(`document.querySelector('.method-trigger').click()`);await sleep(350);
 check(await b.evaluate(`document.querySelector('dialog').open`),'method opens as a modal');
 await b.evaluate(`document.querySelector('.guide-footer button').click()`);await sleep(350);
 check(await b.evaluate(`document.querySelector('#guide-title').textContent.includes('Separate')`),'guide advances to live example');
 await capture('orbital-guide-1440');
 await b.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 check(await b.evaluate(`!document.querySelector('dialog').open`),'Escape closes modal');
 await b.navigate('/?at=2026-09-20T20:00:00Z',390);
 check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth`),'mobile has no horizontal overflow');
 await capture('orbital-overview-390');
 await b.evaluate(`document.querySelector('.method-trigger').click()`);await sleep(350);await capture('orbital-guide-390');
 for(const route of ['instrument/rTSLA','record']){await b.navigate('/'+route+'?at=2026-09-20T20:00:00Z',1440);check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth&&!document.body.textContent.includes('could not render')`),`${route} renders`);await capture('orbital-'+route.split('/')[0]+'-1440');}
 check(!b.errors.length,'no browser exceptions');
}finally{b.close();}
