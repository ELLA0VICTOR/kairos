import { SyntheticProvider } from './synthetic';
import type { MarketDataProvider } from './types';
const provider = new SyntheticProvider();
/** Real provider resolution is deliberately deferred until Phase 10. */
export function getProvider(): MarketDataProvider { return provider; }
export function onProviderChange(_cb: (p: MarketDataProvider) => void): () => void { return () => {}; }
