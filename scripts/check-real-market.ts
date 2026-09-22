import {readFile} from 'node:fs/promises';
import type {RealMarket} from '../engine/artifacts.js';
import {realResearchData} from '../engine/real-market.js';
import {bitgetRequest} from '../api/_bitget.js';
import {adaptQuotes} from '../src/data/providers/bitget-adapters.js';
import {research} from '../api/_research.js';
const bundle=JSON.parse(await readFile('public/data/real-market.json','utf8')) as RealMarket;
const quotes=adaptQuotes(await bitgetRequest({method:'quotes'}),bundle.data.universe.map(i=>i.symbol));
const data=realResearchData(bundle,quotes.quotes,Date.now());
for(const question of ['Explain rNVDA','Explain rAAPL','Compare rAMD and rNVDA','What is moving?','Risk of holding rTSLA','Can I trust the model?']){
 let done=false,steps=0;
 for await(const event of research(question,data)){
  if(event.type==='step')steps++;
  if(event.type==='done'){done=true;if(event.data.note.paragraphs.join(' ').replace(/\{\{fig:[^}]+\}\}/g,'').match(/\d/))throw new Error('Unreferenced number');if(!event.data.note.confidenceReason.includes('real data'))throw new Error('Incorrect provenance');}
 }
 if(!done||steps>6)throw new Error('Research contract failed');
 console.log('PASS real-data fallback research: '+question+'; '+steps+' tools.');
}
console.log('PASS '+data.snapshot.rows.length+' real rows; session '+data.snapshot.session.state+'; '+data.snapshot.rows.filter(r=>r.forecast).length+' active forecasts.');
