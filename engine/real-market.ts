import type {RealMarket,ArtifactSet} from './artifacts.js';
import type {Quote} from './types.js';
import {computeBoard} from './board.js';
import {nyDate,previousClose} from './calendar.js';
/** Refuse mixed sessions and stale quotes; the caller falls back as a whole. */
export function realMarketBoard(bundle:RealMarket,quotes:Quote[],now:number){
 if(bundle.data.source!=='live'||bundle.anchorDate!==nyDate(previousClose(now)))throw new Error('Real official-close anchors need refreshing');
 if(bundle.data.universe.some(i=>!quotes.some(q=>q.symbol===i.symbol&&q.price>0&&Number.isFinite(q.price)&&now-q.ts<=15*60000&&q.ts<=now+60000)||!(bundle.anchors[i.symbol]!>0)||!bundle.data.params.instruments[i.symbol]?.estimateStability))throw new Error('Incomplete or stale real market bundle');
 return computeBoard(bundle.data,{ts:now,quotes,anchors:bundle.anchors,news:[],candles:{}});
}
export function realResearchData(bundle:RealMarket,quotes:Quote[],now:number):ArtifactSet{
 const board=realMarketBoard(bundle,quotes,now);
 return {...bundle.data,snapshot:{ts:now,session:board.session,rows:board.rows,news:board.news}};
}
