// Verified against Bitget instruments on 2026-09-21; never infer token identifiers.
export const SYMBOL_MAP:Record<string,{spot:string;underlying:string}>={
  "rSPY": {
    "spot": "RSPYUSDT",
    "underlying": "SPY"
  },
  "rQQQ": {
    "spot": "RQQQUSDT",
    "underlying": "QQQ"
  },
  "rNVDA": {
    "spot": "RNVDAUSDT",
    "underlying": "NVDA"
  },
  "rTSLA": {
    "spot": "RTSLAUSDT",
    "underlying": "TSLA"
  },
  "rAAPL": {
    "spot": "RAAPLUSDT",
    "underlying": "AAPL"
  },
  "rMSFT": {
    "spot": "RMSFTUSDT",
    "underlying": "MSFT"
  },
  "rAMZN": {
    "spot": "RAMZNUSDT",
    "underlying": "AMZN"
  },
  "rGOOGL": {
    "spot": "RGOOGLUSDT",
    "underlying": "GOOGL"
  },
  "rMETA": {
    "spot": "RMETAUSDT",
    "underlying": "META"
  },
  "rAMD": {
    "spot": "RAMDUSDT",
    "underlying": "AMD"
  },
  "rAVGO": {
    "spot": "RAVGOUSDT",
    "underlying": "AVGO"
  },
  "rNFLX": {
    "spot": "RNFLXUSDT",
    "underlying": "NFLX"
  },
  "rCOIN": {
    "spot": "RCOINUSDT",
    "underlying": "COIN"
  },
  "rMSTR": {
    "spot": "RMSTRUSDT",
    "underlying": "MSTR"
  },
  "rPLTR": {
    "spot": "RPLTRUSDT",
    "underlying": "PLTR"
  },
  "rINTC": {
    "spot": "RINTCUSDT",
    "underlying": "INTC"
  },
  "rMU": {
    "spot": "RMUUSDT",
    "underlying": "MU"
  },
  "rBABA": {
    "spot": "RBABAUSDT",
    "underlying": "BABA"
  },
  "rJPM": {
    "spot": "RJPMUSDT",
    "underlying": "JPM"
  },
  "rHOOD": {
    "spot": "RHOODUSDT",
    "underlying": "HOOD"
  }
};
export const CANONICAL_BY_SPOT=Object.fromEntries(Object.entries(SYMBOL_MAP).map(([symbol,value])=>[value.spot,symbol]));
