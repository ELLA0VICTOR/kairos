import { memo,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { boardSentence,type BoardRow } from '@engine/board';
import { explainedShare } from '@engine/attribute';
import { isAbsurdDrift } from '@engine/quality';
import { useDesk } from '@/data/queries';
import { price,pct,money,share,bandWidth } from '@/lib/format';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { Boundary,Button,Notice,Tag } from '@/components/primitives';
import { Sparkline } from '@/components/charts/Sparkline';
import { DriftCell } from '@/components/domain/DriftCell';
type Sort='Price'|'Drift'|'Trust'|'Explained'|'At bell';
function AnimatedPrice({value}:{value:number}){const {display,flash}=useAnimatedNumber(value);return <span className={flash?'value-flash':''}>{price(display)}</span>;}
const BoardItem=memo(function BoardItem({row,dark,intro,index}:{row:BoardRow;dark:boolean;intro:boolean;index:number}){
 const r=row.reckoning,explained=explainedShare(r.components),f=row.forecast;
 return <Link className="board-row" role="row" to={`/instrument/${row.instrument.symbol}`} aria-label={`${row.instrument.symbol}, ${pct(r.drift)} drift, ${row.liquidity.label} liquidity`}>
   <span role="cell" className="instrument-cell"><strong>{row.instrument.symbol}</strong><small>{row.instrument.name}</small></span>
   <span role="cell" className="numeric"><AnimatedPrice value={r.tokenPrice}/><small>USDT</small></span>
   <span role="cell" className="numeric">{price(r.reckonedValue)}<small>{bandWidth(r.bandLow,r.bandHigh)}</small></span>
   <span role="cell" className="numeric">{dark?<DriftCell value={r} stale={row.stale} intro={intro} index={index}/>:<><span>Not available</span><small>No separate underlying feed</small></>}</span>
   <span role="cell"><Tag tone={row.liquidity.label==='thin'?'amber':row.liquidity.label==='deep'?'verdigris':'dim'}>{row.liquidity.label==='thin'?'Thin book':row.liquidity.label==='deep'?'Deep book':'Moderate'}</Tag><small>{money(row.quote.volumeSinceClose)}</small></span>
   <span role="cell" className="numeric">{share(explained)}<small className="unit-chart" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} className={i<Math.round(explained*5)?'filled':''}/>)}</small></span>
   <span role="cell" className="numeric muted">{f?<>{pct(f.median)}<small>{pct(f.p10)} to {pct(f.p90)}</small></>:<>{isAbsurdDrift(r.drift)?'Outside range':dark?'Unavailable':'Paused'}<small>{isAbsurdDrift(r.drift)?'See Method':'At the bell'}</small></>}</span>
   <span role="cell" className="spark-cell"><Boundary name={`${row.instrument.symbol} price path`}><Sparkline values={row.path} symbol={row.instrument.symbol}/></Boundary></span>
 </Link>;
},(a,b)=>a.dark===b.dark&&a.intro===b.intro&&a.index===b.index&&a.row.stale===b.row.stale&&a.row.quote.price===b.row.quote.price&&a.row.quote.volumeSinceClose===b.row.quote.volumeSinceClose&&a.row.reckoning.bandLow===b.row.reckoning.bandLow&&a.row.reckoning.bandHigh===b.row.reckoning.bandHigh&&a.row.reckoning.drift===b.row.reckoning.drift&&a.row.liquidity.trust===b.row.liquidity.trust&&a.row.forecast?.median===b.row.forecast?.median&&a.row.forecast?.p10===b.row.forecast?.p10&&a.row.forecast?.p90===b.row.forecast?.p90&&a.row.path.length===b.row.path.length&&a.row.path.at(-1)===b.row.path.at(-1));
export default function Window({intro}:{intro:boolean}){
 const {board,loading,error,retry,fallbacks}=useDesk(),[sort,setSort]=useState<Sort>('Drift'),[desc,setDesc]=useState(true),[layout,setLayout]=useState<'auto'|'board'|'cards'>('auto');
 const rows=useMemo(()=>[...board.rows].sort((a,b)=>{if(a.stale!==b.stale)return a.stale?1:-1;const value=(r:BoardRow)=>sort==='Price'?r.quote.price:sort==='Trust'?r.liquidity.trust:sort==='Explained'?explainedShare(r.reckoning.components):sort==='At bell'?r.forecast?.median??0:Math.abs(r.reckoning.drift);return (value(b)-value(a))*(desc?1:-1);}),[board.rows,sort,desc]);
 const sortBy=(s:Sort)=>{setDesc(s===sort?!desc:true);setSort(s);};
 return <><div className="page-heading"><div><h1>{board.session.isDark?'The dark window':'The exchange session'}</h1><p>Every 24/7 tokenized US stock, priced against what the market can still see.</p><span className="muted">{rows.length-2} names with two market anchors. Estimates carry an 80% band.</span></div><div className="view-controls"><Button aria-pressed={layout==='board'} onClick={()=>setLayout('board')}>Board</Button><Button aria-pressed={layout==='cards'} onClick={()=>setLayout('cards')}>Cards</Button></div></div>
 {!board.session.isDark&&<Notice>The exchange is open. Reckoning is paused — the token is tracking a real order book. Independent underlying quotes are not available in this synthetic feed; tracking error is not measured.</Notice>}
 {error&&<Notice retry={retry}>Quotes unavailable. Showing the last complete window. {error}</Notice>}
 {!!fallbacks.length&&<Notice retry={retry}>Using bundled synthetic artifacts: {fallbacks.map(f=>f.split(':')[0]).join(', ')}. Snapshot time remains visible above.</Notice>}
 <p className="sr-only" role="status" aria-live="polite">{loading?'Loading current window. Showing bundled snapshot.':`${rows.length} instruments. Sorted by ${sort.toLowerCase()}, ${desc?'descending':'ascending'}.`}</p>
 <div className={`board layout-${layout}`} role="table" aria-label="Token prices against reckoned value">
 <div className="board-head" role="row"><span role="columnheader">Instrument</span>{(['Price','Reckoned','Drift','Trust','Explained','At bell','Path'] as const).map(s=><span key={s} role="columnheader" aria-sort={s===sort?(desc?'descending':'ascending'):undefined} className={`${s==='Trust'?'':'numeric'} ${s==='Path'?'spark-cell':''}`}>{s==='Reckoned'||s==='Path'?s:<button className={s===sort?'sorted':''} onClick={()=>sortBy(s)}>{s==='Drift'&&!board.session.isDark?'Tracking error':s}{s===sort&&<span className="sort-mark" aria-hidden="true">{desc?' ▾':' ▴'}</span>}</button>}</span>)}</div>
 <div role="rowgroup">{rows.map((row,i)=><BoardItem key={row.instrument.symbol} row={row} dark={board.session.isDark} intro={intro} index={i}/>)}</div>
 {!rows.length&&<Notice retry={retry}>No instruments have usable anchors for this window. Reload the bundled data.</Notice>}
 </div><div className="board-closing"><p>{board.session.isDark?boardSentence(rows):'The reckoning resumes when external price discovery stops.'}</p><Link to="/method">Read the method</Link></div></>;
}
