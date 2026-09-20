import type { Instrument } from '@engine/types';
const item: Pick<Instrument, 'symbol'> = { symbol: 'rNVDA' };
console.log('Script alias resolved:', item.symbol);
