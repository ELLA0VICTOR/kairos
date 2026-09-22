import {browser,check,sleep} from './browser-kit.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await browser(),results=[];
const base=process.env.KAIROS_CHECK_URL??'http://127.0.0.1:4173';
const key=async(key,code=key,modifiers=0)=>{await b.call('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await b.call('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});};
try{
 await b.call('Log.enable');
 for(const width of [390,768,1280,1920])for(const route of ['/','/instrument/rNVDA','/record','/ask','/method']){
   await b.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<640});
   await b.call('Page.navigate',{url:base+route});await sleep(2500);
   if(route==='/method')await b.evaluate(`document.querySelector('dialog details').open=true`);
   check(await b.evaluate(`document.documentElement.scrollWidth<=innerWidth&&!document.body.textContent.includes('could not render')`),`${route} fits ${width}px`);
   if(route==='/method'){
     check(await b.evaluate(`document.querySelectorAll('dialog details').length===10&&document.querySelector('dialog').open`),'all ten Method sections available in modal');
     await b.evaluate(`document.querySelectorAll('dialog details').forEach(d=>d.open=true)`);
     check(await b.evaluate(`document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth`),'expanded Method content fits modal');
     await b.evaluate(`document.querySelectorAll('dialog details').forEach(d=>d.open=false);document.querySelector('dialog summary').focus()`);
     await key('Enter');check(await b.evaluate(`document.querySelector('dialog details').open`),'Method section opens with Enter');
     await b.evaluate(`document.querySelector('dialog .guide-tabs button').focus()`);await key('ArrowRight');check(await b.evaluate(`document.activeElement.id==='guide-tab-1'`),'guide tabs support arrow keys');
     for(let i=0;i<18;i++)await key('Tab');check(await b.evaluate(`!!document.activeElement.closest('dialog')`),'modal retains keyboard focus');
     await key('Escape');check(await b.evaluate(`!document.querySelector('dialog').open`),'Escape closes modal');
     await b.evaluate(`document.querySelector('.method-trigger').focus()`);await key('Enter');await sleep(150);await key('Escape');check(await b.evaluate(`document.activeElement.classList.contains('method-trigger')`),'modal restores trigger focus');
   }
   await b.evaluate(`document.activeElement?.blur();document.querySelector('.skip').focus()`);
   const labels=[];
   const stopCount=await b.evaluate(`Array.from(document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')).filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length&&!e.closest('dialog:not([open])')).length`);
   for(let i=0;i<stopCount+1;i++){
     await key('Tab');
     const focus=await b.evaluate(`(()=>{const e=document.activeElement,s=getComputedStyle(e),wrapper=e.closest('.search-field');return {tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,60),visible:s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none'||!!wrapper&&getComputedStyle(wrapper).borderTopColor==='rgb(188, 245, 155)'};})()`);
     if(focus.tag==='BODY')break;
     if(!focus.visible)throw new Error(`Missing keyboard focus indicator: ${route} ${focus.tag} ${focus.label}`);
     labels.push(focus.label);
   }
   results.push({route,width,keyboardStops:labels.length});
   if(route==='/method')await b.evaluate(`document.querySelector('.method-trigger').click();document.querySelector('dialog details').open=true`);
   await b.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(async r=>{await mkdir('artifacts/screenshots',{recursive:true});await writeFile(`artifacts/screenshots/phase9-${route==='/'?'markets':route.split('/')[1]}-${width}.png`,Buffer.from(r.data,'base64'));});
 }
 check(!b.errors.length,'no browser exceptions across route matrix');
 await writeFile('artifacts/phase9-browser.json',JSON.stringify(results,null,2));
}finally{b.close();}
