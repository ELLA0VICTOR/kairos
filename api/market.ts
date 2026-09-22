import type {IncomingMessage,ServerResponse} from 'node:http';
import {z} from 'zod';
import {bitgetRequest} from './_bitget.js';
const query=z.object({method:z.enum(['candles','daily','news']),symbol:z.string().max(12).optional(),fromTs:z.coerce.number().finite().positive().optional(),interval:z.coerce.number().pipe(z.union([z.literal(5),z.literal(15),z.literal(60)])).optional(),days:z.coerce.number().int().min(1).max(750).optional()});
export default async function market(req:IncomingMessage,res:ServerResponse):Promise<void>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;res.end(JSON.stringify({error:'Use GET'}));return;}
 const parsed=query.safeParse(Object.fromEntries(new URL(req.url??'/', 'http://localhost').searchParams));
 if(!parsed.success){res.statusCode=400;res.end(JSON.stringify({error:'Invalid market query'}));return;}
 try{res.end(JSON.stringify({available:true,raw:await bitgetRequest(parsed.data)}));}catch{res.end(JSON.stringify({available:false,notice:'Bitget data unavailable'}));}
}
