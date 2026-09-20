import type {RecordStats} from '@engine/score';
import {share} from '@/lib/format';
import {signedScore,skillSentence} from '@/lib/record';
export function RecordMetrics({stats,title}:{stats:RecordStats;title:string}){
 const calibration=stats.bandCoverage<.75?'Bands are too narrow':stats.bandCoverage>.85?'Bands are too wide':'Well calibrated';
 return <section className="record-metrics" aria-label={`${title} statistics`}><h2>{title}</h2><p className="micro-note">{stats.n.toLocaleString()} resolved · {stats.nOpen} open</p><div className="metric"><span className="label">Skill score</span><strong className={`metric-number ${stats.n&&stats.skillScore<0?'tone-rust':''}`}>{stats.n?signedScore(stats.skillScore):'—'}</strong><p>{skillSentence(stats)}</p></div><div className="metric"><span className="label">Directional hit rate</span><strong className="metric-number">{stats.n?share(stats.directionalHitRate):'—'}</strong><p>{stats.n?`n=${stats.n.toLocaleString()}`:'Awaiting the first resolved fix'}</p></div><div className="metric"><span className="label">80% band coverage</span><strong className="metric-number">{stats.n?share(stats.bandCoverage):'—'}</strong><p className={stats.n?(calibration==='Well calibrated'?'tone-verdigris':'tone-amber'):''}>Target 80.0%{stats.n?` · ${calibration}`:' · not yet measured'}</p></div></section>;
}
