import type { IncomingMessage,ServerResponse } from 'node:http';
import { getLlmClient } from './_llm.js';
import { research } from './_research.js';
import { loadResearchArtifacts } from './_artifacts.js';
import { rateAllowed } from './_guards.js';
export const config={maxDuration:60};
export default async function ask(req:IncomingMessage&{body?:unknown},res:ServerResponse):Promise<void>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.statusCode=405;res.setHeader('Allow','POST');res.end('Use POST to research a question.');return;}
  const ip=String(req.headers['x-real-ip']??req.socket.remoteAddress??'unknown');
  if(!rateAllowed(ip)){res.statusCode=429;res.setHeader('Retry-After','3600');res.end('Research limit reached. Please return in an hour; the market board remains available.');return;}
  let question:string;
  try {
    let body:unknown=req.body;
    if(body===undefined){let bytes=0,text='';for await(const chunk of req){bytes+=Buffer.byteLength(chunk as Uint8Array);if(bytes>8192)throw new Error('Request too large');text+=String(chunk);}body=JSON.parse(text) as unknown;}
    else if(typeof body==='string')body=JSON.parse(body) as unknown;
    if(!body||typeof body!=='object'||!('question' in body)||typeof body.question!=='string'||!body.question.trim()||body.question.length>1500)throw new Error('Enter a question of up to 1500 characters.');
    question=body.question.trim();
  }catch{res.statusCode=400;res.end('Enter a question of up to 1500 characters.');return;}
  const controller=new AbortController();res.on('close',()=>controller.abort());
  try {
    const data=await loadResearchArtifacts(),client=getLlmClient();
    res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders();
    res.write(': research connected\n\n');
    for await(const event of research(question,data,{client,signal:controller.signal})){
      if(controller.signal.aborted)break;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      // Yield to the socket so the deterministic route is genuinely incremental too.
      await new Promise<void>(resolve=>setTimeout(resolve,event.type==='prose'?5:15));
    }
  }catch {if(!res.headersSent){res.statusCode=503;res.end('Saved research data is unavailable. Use the bundled offline research.');return;}}
  res.end();
}
