import { isTradingDay,regularOpen } from '@engine/calendar';
import { context } from './pipeline-context';
import { fetchHistory } from './fetch-history';
import { snapshot } from './snapshot';
import { resolveLedger } from './resolve';
export function resolutionDue(ts:number):boolean{return isTradingDay(new Date(ts))&&ts>=regularOpen(new Date(ts)).getTime();}
const c=context();
// Fresh runners have no raw history. Rebuild that inexpensive cache before snapshotting.
await fetchHistory(c);
if(resolutionDue(c.asOf))await resolveLedger(c);
await snapshot(c);
console.log('Scheduled refresh complete. Existing backtest and parameter estimates retained.');
