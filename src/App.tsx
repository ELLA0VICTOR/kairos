import type { Artifact, Snapshot } from '@engine/artifacts';
import rawSnapshot from './data/fallback/snapshot.json';
const snapshot = rawSnapshot as Artifact<Snapshot>;
const hero = snapshot.data.rows.find(row => row.instrument.symbol === 'rTSLA');
const pct = (value: number): string => `${value >= 0 ? '+' : ''}${(Math.expm1(value) * 100).toFixed(1)}%`;
export default function App() {
 return <main id="main" className="max-w-container mx-auto px-4 sm:px-6 py-8">
 <p className="font-display text-title">Kairos</p>
 <section className="border-t border-rule mt-8 pt-6">
 <h1 className="font-display text-display-l font-light">The hours Wall Street is shut.</h1>
 <p className="text-body text-bone-dim mt-4 max-w-prose">A research desk for tokenized US stocks. Reckoned value, the evidence behind a move, and a record that can be checked.</p>
 <p className="text-label text-amber mt-8">Demo mode — synthetic data.</p>
 <p className="text-body mt-4 max-w-prose">The research engine covers {snapshot.data.rows.length} instruments. Every estimate below comes from the bundled synthetic snapshot.</p>
 <p className="text-label text-bone-dim mt-4">Snapshot {new Date(snapshot.generatedAt).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}</p>
 {hero && <section className="border-y border-rule mt-8 py-6 max-w-prose" aria-labelledby="sample-title">
   <h2 id="sample-title" className="text-title">{hero.instrument.symbol} — drift from reckoned value</h2>
   <p className="font-display font-light text-display-l mt-4">{pct(hero.reckoning.drift)}</p>
   <p className="text-body text-bone-dim mt-4">80% reckoning band: ${hero.reckoning.bandLow.toFixed(2)} to ${hero.reckoning.bandHigh.toFixed(2)}. Traded price: ${hero.quote.price.toFixed(2)}.</p>
   <p className="text-body mt-4">{hero.liquidity.label === 'thin' ? 'Thin book' : hero.liquidity.label === 'deep' ? 'Deep book' : 'Moderate liquidity'}. {hero.liquidity.reasons[0]}.</p>
   <p className="text-body text-bone-dim mt-4">Next sighting: {new Date(snapshot.data.session.nextOpenTs).toISOString().replace('T', ' ').replace('.000Z', ' UTC')}.</p>
 </section>}
 <nav aria-label="Research data" className="flex flex-wrap gap-4 mt-8 text-body">
   <a href="/data/snapshot.json" download className="underline underline-offset-4">Download snapshot</a>
   <a href="/data/ledger-backtest.json" download className="underline underline-offset-4">Download backtest</a>
   <a href="/data/params.json" download className="underline underline-offset-4">Download parameters</a>
 </nav>
 <p className="text-body text-bone-dim mt-8 max-w-prose">Backtest paths are reconstructed simulations, not historical rToken trades. Forward fixes also use synthetic prices. Neither is a record of real-market performance.</p>
 </section></main>;
}
