import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { type BoardRow } from '@engine/board';
import { explainedShare } from '@engine/attribute';
import { isAbsurdDrift } from '@engine/quality';
import { useDesk } from '@/data/queries';
import { price, pct, money, share, bandWidth } from '@/lib/format';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { Boundary, Button, Notice, Tag, Tooltip } from '@/components/primitives';
import { Sparkline } from '@/components/charts/Sparkline';
import { DriftCell } from '@/components/domain/DriftCell';
import { SessionBar } from '@/components/chrome/SessionBar';
import { Icon } from '@/components/primitives/Icon';
import { CompanyMark } from '@/components/domain/CompanyMark';
type Sort = 'Price' | 'Drift' | 'Trust' | 'Explained' | 'At bell';
const isAnchor = (row: BoardRow) => ['rSPY', 'rQQQ'].includes(row.instrument.symbol);
const outside = (row: BoardRow) => !row.stale && (row.quote.price > row.reckoning.bandHigh || row.quote.price < row.reckoning.bandLow);
function AnimatedPrice({ value }: {
    value: number;
}) { const { display, flash } = useAnimatedNumber(value); return <span className={flash ? 'value-flash' : ''}>{price(display)}</span>; }
const BoardItem = memo(function BoardItem({ row, dark, intro, index }: {
    row: BoardRow;
    dark: boolean;
    intro: boolean;
    index: number;
}) {
    const r = row.reckoning, f = row.forecast, explained = explainedShare(r.components);
    return <Link className="board-row" role="row" to={`/instrument/${row.instrument.symbol}`} aria-label={`${row.instrument.symbol}, ${pct(r.drift)} drift, ${row.liquidity.label} liquidity`}>
 <span role="cell" className="instrument-cell"><CompanyMark symbol={row.instrument.symbol}/><span><strong>{row.instrument.symbol}</strong><small>{row.instrument.name}</small></span></span>
 <span role="cell" className="numeric" data-label="Price"><AnimatedPrice value={r.tokenPrice}/></span>
 <span role="cell" className="numeric" data-label="Fair value">{price(r.reckonedValue)}<small>{bandWidth(r.bandLow, r.bandHigh)}</small></span>
 <span role="cell" className="numeric" data-label="Drift">{dark ? <DriftCell value={r} stale={row.stale} intro={intro} index={index}/> : <><span className="muted">—</span><small>Paused</small></>}</span>
 <span role="cell" className="liquidity-cell" data-label="Liquidity"><Tag tone={r.trustLabel === 'thin' ? 'amber' : r.trustLabel === 'deep' ? 'verdigris' : 'dim'}>{r.trustLabel === 'thin' ? 'Thin' : r.trustLabel === 'deep' ? 'Deep' : 'Moderate'}</Tag><small>{money(row.quote.volumeSinceClose)}</small></span>
 <span role="cell" className="numeric explained-cell" data-label="Explained">{share(explained)}<small className="unit-chart" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < Math.round(explained * 5) ? 'filled' : ''}/>)}</small></span>
 <span role="cell" className="numeric muted" data-label="At open">{f ? <>{pct(f.median)}<small>{pct(f.p10)} to {pct(f.p90)}</small></> : <>{isAbsurdDrift(r.drift) ? 'Outside range' : dark ? 'Unavailable' : 'Paused'}</>}</span>
 <span role="cell" className="spark-cell"><Boundary name={`${row.instrument.symbol} price path`}><Sparkline values={row.path} symbol={row.instrument.symbol}/></Boundary></span>
 </Link>;
});
export default function Window({ intro }: {
    intro: boolean;
}) {
    const { board, data, loading, error, retry, fallbacks } = useDesk(), [sort, setSort] = useState<Sort>('Drift'), [desc, setDesc] = useState(true), [layout, setLayout] = useState<'auto' | 'board' | 'cards'>('auto'), [query, setQuery] = useState(''), [group, setGroup] = useState<'stocks' | 'signals' | 'anchors'>('stocks');
    const stocks = board.rows.filter(r => !isAnchor(r)), signals = stocks.filter(outside), widest = stocks.filter(r=>!r.stale&&data.params.instruments[r.instrument.symbol]?.estimateStability!=='unstable').sort((a, b) => Math.abs(b.reckoning.drift) - Math.abs(a.reckoning.drift))[0];
    const rows = useMemo(() => board.rows.filter(r => (group === 'anchors' ? isAnchor(r) : !isAnchor(r) && (group !== 'signals' || outside(r))) && `${r.instrument.symbol} ${r.instrument.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => { if (a.stale !== b.stale)
        return a.stale ? 1 : -1; const value = (r: BoardRow) => sort === 'Price' ? r.quote.price : sort === 'Trust' ? r.liquidity.trust : sort === 'Explained' ? explainedShare(r.reckoning.components) : sort === 'At bell' ? r.forecast?.median ?? 0 : Math.abs(r.reckoning.drift); return (value(b) - value(a)) * (desc ? 1 : -1); }), [board.rows, sort, desc, query, group]);
    const sortBy = (s: Sort) => { setDesc(s === sort ? !desc : true); setSort(s); };
    return <div className="overview">
 <SessionBar intro={intro}/>
 <div className="window-summary"><div><span className="summary-icon"><Icon name="layers"/></span><span><small>Instruments followed</small><strong>{stocks.length} <em>tokenized stocks</em></strong></span></div><button onClick={() => setGroup('signals')}><span className="summary-icon"><Icon name="chart"/></span><span><small>Outside the fair-value band</small><strong>{board.session.isDark ? signals.length : '—'} <em>{board.session.isDark ? 'worth a closer look' : 'reckoning paused'}</em></strong></span></button>{widest && <Link to={`/instrument/${widest.instrument.symbol}`}><span className="summary-icon"><Icon name="arrow"/></span><span><small>Largest eligible drift</small><strong>{widest.instrument.symbol} <em className={widest.reckoning.drift > 0 ? 'tone-rust' : 'tone-verdigris'}>{pct(widest.reckoning.drift)}</em></strong></span><Icon name="chevron" size={15}/></Link>}</div>
 {!board.session.isDark && <p className="session-status" role="status"><span className="status-dot"/>{board.session.state==='extended'?'Extended trading':'Exchange open'}<span>Gap forecasts resume when the exchange goes dark.</span></p>}{error && <Notice retry={retry}>Showing the last available quotes. {error}</Notice>}{fallbacks.length > 0 && <p className="offline-note">Offline snapshot in use <Button variant="quiet" onClick={retry}>Refresh</Button></p>}
 <section className="market-table" id="markets"><header className="market-section-title"><div><span className="eyebrow">[01] / PRICE DISCOVERY</span><h2>The dark window<span>.</span></h2></div><span>TRADABLE 24/7. RECKONED IN CONTEXT.</span></header><div className="market-toolbar"><div className="filter-tabs" aria-label="Instrument groups">{(['stocks', 'signals', 'anchors'] as const).map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'stocks' ? 'All stocks' : g === 'signals' ? 'Outside band' : 'Market anchors'}<span>{g === 'stocks' ? stocks.length : g === 'signals' ? signals.length : board.rows.length - stocks.length}</span></button>)}</div><div className="table-tools"><label className="search-field"><Icon name="search" size={16}/><input aria-label="Find an instrument" placeholder="Search assets…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label><div className="view-controls"><Button aria-label="Table view" aria-pressed={layout !== 'cards'} onClick={() => setLayout('board')}><Icon name="list" size={16}/></Button><Button aria-label="Card view" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}><Icon name="grid" size={16}/></Button></div></div></div>
 <div className="table-context"><span>{rows.length} {rows.length === 1 ? 'instrument' : 'instruments'} <span className="context-divider">/</span> Prices in USDT</span><span className="board-key">Drift = price vs. fair value <Tooltip label="What drift means">Positive drift means the token trades above our estimate; negative means below. Each estimate includes an 80% band.</Tooltip></span><label className="mobile-sort">Sort <select aria-label="Sort instruments" value={sort} onChange={e => { setSort(e.target.value as Sort); setDesc(true); }}>{(['Drift', 'Price', 'Trust', 'Explained', 'At bell'] as Sort[]).map(s => <option key={s}>{s}</option>)}</select></label></div>
 <p className="sr-only" role="status">{loading ? 'Loading market data.' : `${rows.length} instruments. Sorted by ${sort}, ${desc ? 'descending' : 'ascending'}.`}</p>
 <div className={`board layout-${layout}`} role="table" aria-label="Token prices against reckoned value"><div className="board-head" role="row"><span role="columnheader">Instrument</span>{(['Price', 'Reckoned', 'Drift', 'Trust', 'Explained', 'At bell', 'Path'] as const).map(s => <span key={s} role="columnheader" aria-sort={s === sort ? (desc ? 'descending' : 'ascending') : undefined} className={`${s === 'Trust' ? '' : 'numeric'} ${s === 'Path' ? 'spark-cell' : ''} ${s === 'Explained' ? 'explained-cell' : ''}`}>{s === 'Reckoned' || s === 'Path' ? (s === 'Reckoned' ? 'Fair value' : 'Window') : <button className={s === sort ? 'sorted' : ''} onClick={() => sortBy(s)}>{s === 'Trust' ? 'Liquidity' : s === 'At bell' ? 'At open' : s}{s === sort && <span className="sort-mark" aria-hidden="true">{desc ? ' ↓' : ' ↑'}</span>}</button>}</span>)}</div><div role="rowgroup">{rows.map((r, i) => <BoardItem key={r.instrument.symbol} row={r} dark={board.session.isDark} intro={intro} index={i}/>)}</div>{!rows.length && <div className="empty"><h3>No instruments here</h3><p>Try another symbol or group.</p><Button variant="quiet" onClick={() => { setQuery(''); setGroup('stocks'); }}>Show all stocks</Button></div>}</div><div className="board-closing"><span><span className="status-dot"/>Updates every 30 seconds</span><Link to="/record">See how the model performs <Icon name="arrow" size={14}/></Link></div></section></div>;
}
