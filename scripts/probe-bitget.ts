import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadEnv} from 'vite';
const env=loadEnv('development',process.cwd(),''),endpoint=process.env.BITGET_MCP_URL??env.BITGET_MCP_URL??'https://agent.bitget.com/mcp';
const output=resolve('raw/probe');await mkdir(output,{recursive:true});
let sequence=0,session:string|undefined;
async function rpc(method:string,params:unknown,file:string){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method,params}),signal:AbortSignal.timeout(20000)});
 session=response.headers.get('mcp-session-id')??session;
 const raw=await response.text();await writeFile(resolve(output,file+'.txt'),raw);
 console.log(`${method}: HTTP ${response.status}; saved ${file}.txt`);
 if(!response.ok)throw new Error(`MCP ${method} returned HTTP ${response.status}`);
 const payload=response.headers.get('content-type')?.includes('text/event-stream')?raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>JSON.parse(line.slice(5))).find(value=>value.id===sequence):JSON.parse(raw);
 if(payload?.error)throw new Error(`MCP error: ${JSON.stringify(payload.error)}`);
 return payload?.result;
}
try{
 if(process.env.KAIROS_PROBE_REST==='1'){
  for(const [name,path] of [['instruments','instruments?category=SPOT'],['ticker','tickers?category=SPOT&symbol=RNVDAUSDT'],['candles','candles?category=SPOT&symbol=RNVDAUSDT&interval=1H&type=market&limit=5']]){
   const response=await fetch('https://api.bitget.com/api/v3/market/'+path,{signal:AbortSignal.timeout(20000)});
   await writeFile(resolve(output,'rest-'+name+'.json'),await response.text());console.log(`REST ${name}: HTTP ${response.status}`);
  }
 }
 await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'kairos-read-only-probe',version:'1.0.0'}},'initialize');
 await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'}),signal:AbortSignal.timeout(20000)});
 let cursor:string|undefined;const tools:unknown[]=[];
 do{const result=await rpc('tools/list',cursor?{cursor}:{},`tools-${tools.length}`);tools.push(...(result.tools??[]));cursor=result.nextCursor;}while(cursor);
 await writeFile(resolve(output,'tools.json'),JSON.stringify(tools,null,2));
 console.log(`Enumerated ${tools.length} tool schemas. Inspect raw/probe/tools.json before selecting read-only calls.`);
 // Subsequent calls must use names/arguments selected after inspecting schemas.
 if(process.env.KAIROS_PROBE_TOOL){const args=JSON.parse(process.env.KAIROS_PROBE_ARGS??'{}');const result=await rpc('tools/call',{name:process.env.KAIROS_PROBE_TOOL,arguments:args},'call-'+process.env.KAIROS_PROBE_TOOL.replace(/[^a-z0-9_-]/gi,'_')+'-'+Date.now());await writeFile(resolve(output,'latest.json'),JSON.stringify(result?.structuredContent??result,null,2));}
}catch(error){console.error(error instanceof Error?error.message:'Probe failed');process.exitCode=1;}
