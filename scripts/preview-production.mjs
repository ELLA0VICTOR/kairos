// Match production transfer compression when measuring the built site locally.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {gzipSync} from 'node:zlib';
const root=resolve('dist'),cache=new Map();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.startsWith('/api/')){res.writeHead(503);res.end('Local static preview: API unavailable');return;}
  const file=resolve(root,'.'+(extname(pathname)?pathname:'/index.html'));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const zip=/gzip/.test(req.headers['accept-encoding']??'')&&/\.(html|js|css|json|svg)$/.test(file),key=file+zip;
  let body=extname(file)==='.html'?undefined:cache.get(key);if(!body){body=await readFile(file);if(zip)body=gzipSync(body);cache.set(key,body);}
  res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Vary':'Accept-Encoding','Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600',...(zip?{'Content-Encoding':'gzip'}:{}),'Content-Length':body.length});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4177,'127.0.0.1',()=>console.log('Compressed production preview: http://127.0.0.1:4177'));
