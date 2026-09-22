import {expect,it} from 'vitest';
import {adaptQuotes,adaptCandles,adaptDailyBars,adaptNews} from '../src/data/providers/bitget-adapters';
import {BitgetProvider} from '../src/data/providers/bitget';
import {FallbackProvider} from '../src/data/providers/fallback';
import {SyntheticProvider} from '../src/data/providers/synthetic';
import {UNIVERSE} from '../src/data/providers/anchors';
import {ProviderError} from '../src/data/providers/types';
const quote={symbol:'RNVDAUSDT',lastPrice:'227.09',bid1Price:'227',ask1Price:'227.1',ts:'1790026163155',volume24h:'49912441.5071',turnover24h:'11326672822.6523',platformTurnover24h:'79858567.6897'};
const ticker={code:'00000',requestTime:1790026164510,data:[quote]};
it('maps observed rToken identifiers and uses platform USDT turnover, not base volume',()=>{
 const q=adaptQuotes(ticker,['rNVDA']).quotes[0]!;expect(q.symbol).toBe('rNVDA');expect(q.price).toBe(227.09);expect(q.volume24h).toBe(79858567.6897);expect(q.volumeSinceClose).toBeNull();
});
it('rejects malformed payloads as typed provider errors and neutralizes crossed books',()=>{
 for(const value of ['',null,'NaN','-1'])expect(()=>adaptQuotes({...ticker,data:[{...quote,lastPrice:value}]},['rNVDA'])).toThrow(ProviderError);
 expect(()=>adaptQuotes({...ticker,code:'40001'},['rNVDA'])).toThrow(ProviderError);
 expect(adaptQuotes({...ticker,data:[{...quote,bid1Price:'240'}]},['rNVDA']).quotes[0]).toMatchObject({bid:null,ask:null});
});
it('keeps candle quote turnover distinct and refuses unknown historical volume',()=>{
 const raw={code:'00000',requestTime:1790026164510,data:[['1790010000000','226','228','225','227','10','2270']]};
 expect(adaptCandles(raw)[0]).toMatchObject({close:227,volume:2270});
 expect(()=>adaptCandles({...raw,data:[['1790010000000','226','228','225','227','','']]})).toThrow(ProviderError);
});
it('sorts official bars and calculates gaps from previous close, rejecting wrong symbols',()=>{
 const row={symbol:'NVDA',date:'2026-09-18T04:00:00Z',open:100,close:101,high:102,low:99,volume:20};
 const raw={success:true,status_code:200,data:{results:[{...row,date:'2026-09-21T04:00:00Z',open:102,close:103,high:104},row]}};
 expect(adaptDailyBars(raw,'NVDA')[1]!.gapLogReturn).toBeCloseTo(Math.log(102/101));
 expect(()=>adaptDailyBars(raw,'MSFT')).toThrow(ProviderError);
});
it('does not invent headline impacts or render source HTML',()=>{
 const news=adaptNews({success:true,status_code:200,data:{results:[{title:'Market update',published_at:'2026-09-21T08:48:45.120000Z',content:'<script>bad()</script>'}]}},0);
 expect(news[0]).toMatchObject({headline:'Market update',impact:null,impactConfidence:null,source:'Bitget'});expect(news[0]).not.toHaveProperty('content');
});
it('falls back immediately on malformed quotes, avoids retry thrashing, recovers after 60s',async()=>{
 let now=1790026164510,calls=0,healthy=false;
 const live=new BitgetProvider(UNIVERSE,async()=>{calls++;return healthy?ticker:{bad:true};});
 const p=new FallbackProvider(live,new SyntheticProvider(42,()=>now),()=>now);
 expect((await p.getQuotes(['rNVDA'])).quotes).toHaveLength(1);expect(p.health().methods?.getQuotes?.source).toBe('synthetic');
 await p.getQuotes(['rNVDA']);expect(calls).toBe(1);
 now+=60000;healthy=true;expect((await p.getQuotes(['rNVDA'])).quotes[0]!.price).toBe(227.09);expect(p.health().methods?.getQuotes?.source).toBe('bitget');expect(calls).toBe(2);
});
it('tracks failures by method without hiding a working quote feed',async()=>{
 const p=new BitgetProvider(UNIVERSE,async request=>{if(request.method==='quotes')return ticker;throw new Error('Offline');});
 await expect(p.getNews(0)).rejects.toThrow(ProviderError);await p.getQuotes(['rNVDA']);
 expect(p.health().methods?.getNews?.ok).toBe(false);expect(p.health().methods?.getQuotes?.ok).toBe(true);expect(p.health().ok).toBe(false);
});
