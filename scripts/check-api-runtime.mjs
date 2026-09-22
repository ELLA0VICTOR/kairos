// Exercise emitted server code in plain Node, without Vite/tsx import resolution.
import ts from 'typescript';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
await mkdir(resolve(root,'raw'),{recursive:true});
const output=await mkdtemp(resolve(root,'raw/api-runtime-'));
const visited=new Set();
async function emit(file){
  if(visited.has(file))return;
  visited.add(file);
  const source=await readFile(file,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const target=resolve(output,relative(root,file).replace(/\.ts$/,'.js'));
  await mkdir(dirname(target),{recursive:true});await writeFile(target,js);
  const ast=ts.createSourceFile(target,js,ts.ScriptTarget.Latest,true);
  for(const statement of ast.statements){
    if((ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement))&&statement.moduleSpecifier&&ts.isStringLiteral(statement.moduleSpecifier)){
      const spec=statement.moduleSpecifier.text;
      if(spec.startsWith('.'))await emit(resolve(dirname(file),spec.replace(/\.js$/,'')+'.ts'));
    }
  }
}
await emit(resolve(root,'api/quotes.ts'));await emit(resolve(root,'api/ask.ts'));
await writeFile(resolve(output,'check.mjs'),`
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import quotes from './api/quotes.js';
import ask from './api/ask.js';
const server=createServer((req,res)=>{Promise.resolve(req.url.startsWith('/api/quotes')?quotes(req,res):ask(req,res)).catch(error=>{console.error(error);res.statusCode=500;res.end('Failure');});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try {
 const quoteResponse=await fetch(base+'/api/quotes?symbols=rNVDA');assert.equal(quoteResponse.status,200);
 const data=await quoteResponse.json();assert.equal(data.quotes.length,1);assert.equal(data.quotes[0].symbol,'rNVDA');assert.equal(data.dataSource,'synthetic');
 assert.equal((await fetch(base+'/api/quotes',{method:'POST'})).status,405);
 assert.equal((await fetch(base+'/api/ask')).status,405);
 const start=Date.now(),response=await fetch(base+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'Why is rNVDA moving?'})});
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\\/event-stream/);
 let body='',chunks=0;for await(const chunk of response.body){body+=new TextDecoder().decode(chunk);chunks++;}
 assert.match(body,/event: step/);assert.match(body,/event: prose/);assert.match(body,/event: done/);assert.match(body,/"mode":"none"/);
 assert.ok((body.match(/event: step/g)||[]).length<=6);assert.ok(Date.now()-start<45000);assert.ok(chunks>1);
 console.log('PASS: plain Node ESM imports; quotes/filter/405; Ask fallback streams multiple chunks within six tools / 45 seconds.');
} finally {await new Promise(resolve=>server.close(resolve));}
`);
const env={...process.env};delete env.OPENAI_API_KEY;delete env.QWEN_API_KEY;
env.VITE_DATA_SOURCE='synthetic';
const result=spawnSync(process.execPath,[resolve(output,'check.mjs')],{cwd:root,env,stdio:'inherit',timeout:60000});
if(result.error)throw result.error;
process.exitCode=result.status??1;
