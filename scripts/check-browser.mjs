import { writeFile } from 'node:fs/promises';

// Uses the installed Edge browser via CDP; no browser automation dependency.
const targets = await (await fetch(`http://127.0.0.1:${process.env.KAIROS_CDP_PORT ?? 9222}/json`)).json();
const target = targets.find(item => item.type === 'page');
if (!target) throw new Error('No browser page available');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const errors = [];
const externalRequests = [];
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Network.requestWillBeSent' && /^https?:/.test(msg.params.request.url) && !msg.params.request.url.startsWith('http://127.0.0.1:5173/')) externalRequests.push(msg.params.request.url);
  if (msg.id) { pending.get(msg.id)?.(msg); pending.delete(msg.id); }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const key = ++id;
  const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000);
  pending.set(key, msg => { clearTimeout(timeout); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); });
  ws.send(JSON.stringify({ id: key, method, params }));
});
await call('Page.enable');
await call('Runtime.enable');
await call('Network.enable');
await call('Network.setCacheDisabled', { cacheDisabled: true });
await call('Network.setBlockedURLs', { urls: ['https://*'] });
const width = Number(process.argv[3] ?? 1280);
await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 640 });
errors.length = 0;
await call('Page.navigate', { url: `http://127.0.0.1:5173${process.argv[4] ?? '/'}` });
await new Promise(resolve => setTimeout(resolve, 6000));
const result = await call('Runtime.evaluate', {
  expression: `(async () => { await document.fonts.ready; return { title: document.title, background: getComputedStyle(document.body).backgroundColor, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, fonts: [...document.fonts].map(f => ({family: f.family, weight: f.weight, status: f.status})), text: document.body.innerText }; })()`,
  awaitPromise: true, returnByValue: true,
});
console.log(JSON.stringify({...result.result.value,text:result.result.value.text.slice(0,600)}, null, 2));
if (result.result.value.background !== 'rgb(14, 22, 34)') throw new Error('Incorrect canvas color');
if (result.result.value.scrollWidth > result.result.value.width) throw new Error('Horizontal overflow');
if (errors.length || externalRequests.length) throw new Error(JSON.stringify({errors,externalRequests}));
const screenshot = await call('Page.captureScreenshot', { format: 'png' });
await writeFile(`artifacts/screenshots/${process.argv[2] ?? 'phase-0'}.png`, Buffer.from(screenshot.data, 'base64'));
ws.close();
