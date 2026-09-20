import type { Instrument } from '@engine/types';
export interface SimulationAnchor extends Instrument {
  price: number; beta: number; gamma: number; idioVol: number; weekdayNotional: number;
}
// Plausible 2026 levels: seeds for simulation only, never official market prices.
const rows: Array<[string,string,Instrument['sector'],number,number,number]> = [
  ['SPY','S&P 500 ETF','financials',670,1,.04],['QQQ','Nasdaq 100 ETF','megacap_tech',610,1,.04],
  ['NVDA','NVIDIA Corporation','semis',184.2,1.7,.10],['TSLA','Tesla, Inc.','consumer_growth',393.7,1.9,.14],
  ['AAPL','Apple Inc.','megacap_tech',248,1.05,.09],['MSFT','Microsoft Corporation','megacap_tech',515,.95,.08],
  ['AMZN','Amazon.com, Inc.','megacap_tech',239,1.15,.12],['GOOGL','Alphabet Inc.','megacap_tech',218,1.1,.11],
  ['META','Meta Platforms, Inc.','megacap_tech',755,1.25,.13],['AMD','Advanced Micro Devices','semis',178,1.8,.16],
  ['AVGO','Broadcom Inc.','semis',340,1.5,.12],['NFLX','Netflix, Inc.','consumer_growth',122,1.2,.13],
  ['COIN','Coinbase Global, Inc.','crypto_beta',325,2.2,.22],['MSTR','Strategy Inc.','crypto_beta',410,2.4,.25],
  ['PLTR','Palantir Technologies','software',165,1.6,.17],['INTC','Intel Corporation','semis',28,1.25,.14],
  ['MU','Micron Technology','semis',138,1.55,.13],['BABA','Alibaba Group','consumer_growth',148,1.1,.14],
  ['JPM','JPMorgan Chase & Co.','financials',298,.75,.07],['HOOD','Robinhood Markets','crypto_beta',112,1.9,.21],
];
export const ANCHORS: SimulationAnchor[] = rows.map(([underlying,name,sector,price,beta,idioVol]) => ({
  symbol:`r${underlying}`,underlying,name,sector,price,beta,idioVol,
  anchorFactor: underlying === 'SPY' || underlying === 'JPM' ? 'rSPY' : 'rQQQ',
  weekend247:true,gamma: underlying === 'JPM' || underlying === 'PLTR' ? 0 : .65,
  weekdayNotional: underlying === 'TSLA' ? 3_400_000 : 12_000_000,
}));
export const UNIVERSE: Instrument[] = ANCHORS.map(({symbol,underlying,name,sector,anchorFactor,weekend247}) => ({symbol,underlying,name,sector,anchorFactor,weekend247}));
export const isAnchor = (symbol: string): boolean => symbol === 'rSPY' || symbol === 'rQQQ';
