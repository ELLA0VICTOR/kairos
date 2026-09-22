import type { Attribution, NewsItem } from './types.js';
import { mean } from './stats.js';
export function aggregateNews(items:NewsItem[],symbol:string,anchorTs:number,now:number):{impact:number;uncertainty:number;drivers:Attribution['newsDrivers']} {
  const relevant=items.filter(n=>!n.preAnchor&&n.ts>=anchorTs&&n.ts<=now&&(!n.symbols.length||n.symbols.includes(symbol)));
  const known=relevant.filter(n=>n.impact!==null);
  const sum=known.reduce((v,n)=>v+n.impact!,0), impact=.1*Math.tanh(sum/.1);
  const confidence=known.length?mean(known.map(n=>n.impactConfidence??0)):0;
  const scale=sum===0?1:impact/sum;
  return {impact,uncertainty:relevant.length?Math.max(.002,.5*Math.abs(impact)*(1-confidence)):0,
    drivers:known.filter(n=>n.impact!==0).map(n=>({id:n.id,headline:n.headline,contribution:n.impact!*scale})).sort((a,b)=>Math.abs(b.contribution)-Math.abs(a.contribution)).slice(0,5)};
}
