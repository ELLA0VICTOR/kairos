import { expect, test } from 'vitest';
import type { Instrument } from '@engine/types';
test('shared types resolve in tests', () => { const item: Pick<Instrument, 'symbol'> = { symbol: 'rNVDA' }; expect(item.symbol).toBe('rNVDA'); });
