const inverted = new Set(['AAPL','AMZN','AMD','PLTR','MU','JPM','SPY','QQQ']);
export function CompanyMark({symbol}:{symbol:string}) {
  const ticker=symbol.startsWith('r')?symbol.slice(1):symbol;
  return <span className="company-mark" aria-hidden="true"><img src={`/logos/${ticker}.png`} alt="" width="28" height="28" className={inverted.has(ticker)?'logo-light':''}/></span>;
}
