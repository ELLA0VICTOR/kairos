import { SyntheticProvider } from './synthetic';
import type { MarketDataProvider } from './types';
const provider = new SyntheticProvider();
/** Real provider resolution is deliberately deferred until Phase 10. */
let replay: {ts:number;provider:MarketDataProvider}|undefined;
export function getProvider(ts?:number): MarketDataProvider {
  if(ts===undefined)return provider;
  if(replay?.ts!==ts)replay={ts,provider:new SyntheticProvider(20260927,()=>ts)};
  return replay.provider;
}
export function onProviderChange(_cb: (p: MarketDataProvider) => void): () => void { return () => {}; }
