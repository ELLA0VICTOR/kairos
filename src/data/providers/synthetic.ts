import { atNy, getSessionInfo, HOUR, isTradingDate, nyDate, previousClose, shiftDate } from '@engine/calendar';
import { clamp, gaussian, hashString, mulberry32 } from '@engine/stats';
import type { Candle, DailyBar, Instrument, NewsCategory, NewsItem, Quote, SessionInfo } from '@engine/types';
import { ANCHORS, isAnchor, type SimulationAnchor } from './anchors';
import { ProviderError, type MarketDataProvider, type ProviderHealth } from './types';

export const SYNTHETIC_SEED = 20260927;
export const SCENARIOS = [
  {id:'clean_news',symbol:'rNVDA',hours:8,impact:.035},
  {id:'risk_off',progress:.2,hoursDuration:3,impact:-.015},
  {id:'liquidity_ghost',symbol:'rTSLA',progress:.62,impact:.048},
  {id:'quiet',symbols:['rAAPL','rMSFT','rJPM']},
] as const;
const STEP = 5 * 60_000;
const YEAR_HOURS = 252 * 24;
export interface SimulatedPoint {
  ts: number; price: number; market: number; sector: number; news: number;
  idio: number; volume: number; cumulativeVolume: number; expectedCumulativeVolume:number;
}
type NewsSeed = [number,string,string[],NewsCategory,number,number];
const headlines: NewsSeed[] = [
  [-1,'Analyst previews the coming earnings calendar',[],'analyst',0,.8],
  [1,'Apple reiterates its existing distribution plans',['rAAPL'],'product',0,.8],
  [3,'Bank executives discuss payment infrastructure',['rJPM'],'other',0,.6],
  [5,'Cloud spending survey is broadly in line with expectations',['rMSFT','rAMZN'],'other',0,.7],
  [8,'NVIDIA raises its simulated delivery outlook after an order review',['rNVDA'],'guidance',.035,.9],
  [9,'Analyst repeats an unchanged Tesla target',['rTSLA'],'analyst',0,.95],
  [11,'Crypto venues report higher settlement activity',['rCOIN','rHOOD'],'crypto',.004,.6],
  [13,'Policy uncertainty weighs on simulated index futures',[],'monetary_policy',0,.7],
  [16,'Micron reports improved supply availability',['rMU'],'supply_chain',.007,.7],
  [19,'Streaming survey tracks a stable subscriber mix',['rNFLX'],'other',0,.6],
  [23,'A semiconductor industry meeting concludes without new guidance',['rAMD','rAVGO'],'other',0,.8],
  [28,'Alphabet outlines a routine product maintenance cycle',['rGOOGL'],'product',0,.8],
  [32,'Alibaba expands a simulated merchant support program',['rBABA'],'product',.003,.6],
  [37,'No change to the simulated software procurement timetable',['rPLTR'],'regulation',0,.7],
  [43,'Meta schedules its next developer update',['rMETA'],'product',0,.8],
  [49,'Strategy discloses an unchanged simulated funding plan',['rMSTR'],'crypto',0,.8],
];

/** Every series is keyed by seed, date/window and symbol, never request order. */
export class SyntheticProvider implements MarketDataProvider {
  readonly id = 'synthetic' as const;
  private readonly paths = new Map<string, SimulatedPoint[]>();
  private readonly histories = new Map<string, DailyBar[]>();
  private readonly times = new Map<number,{day:number;hour:number}>();
  private readonly ghosts = new Map<number,boolean>();
  constructor(
    readonly seed = SYNTHETIC_SEED,
    private readonly clock: () => number = () => Date.now(),
    private readonly anchors: readonly SimulationAnchor[] = ANCHORS,
  ) {}
  async isAvailable(): Promise<boolean> { return true; }
  health(): ProviderHealth { return {id:this.id,ok:true,lastSuccessTs:this.clock(),lastErrorTs:null,lastError:null}; }
  async getUniverse(): Promise<Instrument[]> {
    return this.anchors.map(({symbol,underlying,name,sector,anchorFactor,weekend247}) => ({symbol,underlying,name,sector,anchorFactor,weekend247}));
  }
  private config(symbol: string): SimulationAnchor {
    const config = this.anchors.find(a => a.symbol === symbol || a.underlying === symbol);
    if (!config) throw new ProviderError(this.id,'symbol',`Unknown synthetic instrument: ${symbol}`);
    return config;
  }
  private normal(key: string): number { return gaussian(mulberry32(hashString(`${this.seed}:${key}`))); }
  private ghostActive(anchorTs:number):boolean {
    // Frozen demonstration windows always contain the hero; history also has quiet windows.
    let active=this.ghosts.get(anchorTs);
    if(active===undefined){active=['2026-09-18','2026-09-22'].includes(nyDate(anchorTs))||hashString(`${this.seed}:${anchorTs}:ghost`)%3===0;this.ghosts.set(anchorTs,active);}
    return active;
  }
  private localTime(ts:number):{day:number;hour:number} {
    let value=this.times.get(ts);
    if(!value){const date=nyDate(ts);value={day:new Date(`${date}T12:00:00Z`).getUTCDay(),hour:(ts-atNy(date,'00:00'))/HOUR};this.times.set(ts,value);}
    return value;
  }
  private bars(symbol: string, throughDate: string): DailyBar[] {
    const a=this.config(symbol), key=a.symbol;
    const out=this.histories.get(key)??[];
    if(out.length&&out.at(-1)!.date>=throughDate) return out.filter(b=>b.date<=throughDate);
    let price=out.at(-1)?.close??a.price;
    // Fixed origin means adding days or requesting a different lookback never rewrites history.
    for(let date=out.length?shiftDate(out.at(-1)!.date,1):'2024-01-02'; date<=throughDate; date=shiftDate(date,1)) {
      if(!isTradingDate(date)) continue;
      const marketGap=.007*this.normal(`daily:${date}:${a.anchorFactor}:gap`);
      const marketDay=.008*this.normal(`daily:${date}:${a.anchorFactor}:day`);
      const sectorGap=.003*this.normal(`daily:${date}:${a.sector}:gap`);
      const idioGap=a.idioVol/Math.sqrt(252)*.4*this.normal(`daily:${date}:${a.symbol}:idio-gap`);
      const gap=isAnchor(a.symbol) ? .007*this.normal(`daily:${date}:${a.symbol}:gap`) : a.beta*1.08*marketGap+a.gamma*sectorGap+idioGap;
      const open=price*Math.exp(gap);
      const intra=isAnchor(a.symbol) ? .008*this.normal(`daily:${date}:${a.symbol}:day`) : a.beta*marketDay+a.idioVol/Math.sqrt(252)*this.normal(`daily:${date}:${a.symbol}:idio-day`);
      const close=open*Math.exp(intra), range=Math.abs(this.normal(`daily:${date}:${a.symbol}:range`))*.006+.001;
      out.push({date,open,close,high:Math.max(open,close)*Math.exp(range),low:Math.min(open,close)*Math.exp(-range),volume:a.weekdayNotional*(.8+.4*Math.abs(this.normal(`daily:${date}:${a.symbol}:volume`))),gapLogReturn:out.length?gap:null});
      price=close;
    }
    this.histories.set(key,out); return out;
  }
  async getDailyBars(underlying: string, days: number): Promise<DailyBar[]> {
    if(!Number.isInteger(days)||days<1) throw new ProviderError(this.id,'getDailyBars','Days must be a positive integer');
    return this.bars(underlying,nyDate(previousClose(this.clock()))).slice(-days).map(b=>({...b}));
  }
  clearWindowCache():void { this.paths.clear(); }
  /** Additional synthetic capability for pipeline resolutions; never exposes a future opening print. */
  officialOpen(underlying: string, targetTs: number): number {
    if(targetTs>this.clock() || !isTradingDate(nyDate(targetTs))) throw new ProviderError(this.id,'officialOpen','Opening print not yet available');
    const bar=this.bars(underlying,nyDate(targetTs)).at(-1);
    if(!bar) throw new ProviderError(this.id,'officialOpen','No opening print');
    return bar.open;
  }
  anchorPrice(symbol: string, anchorTs: number): number {
    const bar=this.bars(symbol,nyDate(anchorTs)).at(-1);
    if(!bar) throw new ProviderError(this.id,'anchorPrice','No official synthetic anchor');
    return bar.close;
  }
  private newsFor(session: SessionInfo): NewsItem[] {
    const duration=session.windowDurationMs/HOUR;
    return headlines.map(([hour,headline,symbols,category,impact,confidence],i)=>({
      id:`sim:${session.anchorCloseTs}:${i}`,ts:session.anchorCloseTs+(hour<0?hour:hour<=9?hour:Math.min(hour,duration*.94))*HOUR,
      headline,source:'Kairos simulated wire',url:null,symbols,category,impact,impactConfidence:confidence,preAnchor:hour<0,
    }));
  }
  async getNews(sinceTs: number, symbols?: string[], now=this.clock()): Promise<NewsItem[]> {
    if(!Number.isFinite(sinceTs)) throw new ProviderError(this.id,'getNews','Invalid timestamp');
    return this.newsFor(getSessionInfo(now)).filter(n=>n.ts>=sinceTs&&n.ts<=now&&(!symbols||!n.symbols.length||n.symbols.some(s=>symbols.includes(s))));
  }
  /** Integrated weekday notional; weekend multiplier is exactly 11%. */
  volumeRate(symbol: string, ts: number, anchorTs: number, scenarios = true): number {
    const a=this.config(symbol),{hour:localHour,day}=this.localTime(ts);
    const weekend=day===0||day===6;
    const diurnal=ts-anchorTs<2*HOUR?2.2:localHour<4?.3:localHour<10?1.3:1;
    let scenario=1;
    if(scenarios && symbol==='rTSLA' && this.ghostActive(anchorTs)) scenario=.07;
    if(scenarios && symbol==='rNVDA' && ts>=anchorTs+8*HOUR) scenario=8;
    return a.weekdayNotional/24*diurnal*(weekend?.11:1)*scenario;
  }
  windowPath(symbol: string, session: SessionInfo): SimulatedPoint[] {
    const key=`${symbol}:${session.anchorCloseTs}:${session.nextOpenTs}`;
    const cached=this.paths.get(key); if(cached) return cached;
    const a=this.config(symbol), anchor=this.anchorPrice(symbol,session.anchorCloseTs);
    const marketRng=mulberry32(hashString(`${this.seed}:${session.anchorCloseTs}:${a.anchorFactor}:market`));
    const sectorRng=mulberry32(hashString(`${this.seed}:${session.anchorCloseTs}:${a.sector}:sector`));
    const idioRng=mulberry32(hashString(`${this.seed}:${session.anchorCloseTs}:${symbol}:idio`));
    let marketWalk=0,sectorWalk=0,idioWalk=0,cumulativeVolume=0,expectedCumulativeVolume=0;
    const points: SimulatedPoint[]=[];
    const news=this.newsFor(session);
    for(let ts=session.anchorCloseTs;ts<=session.nextOpenTs;ts+=STEP) {
      const {day}=this.localTime(ts);
      const weekend=day===0||day===6, scale=Math.sqrt(STEP/HOUR/YEAR_HOURS)*(weekend?.4:1);
      if(ts>session.anchorCloseTs) {
        marketWalk+=gaussian(marketRng)*(a.anchorFactor==='rSPY'?.16:.20)*scale;
        sectorWalk+=gaussian(sectorRng)*(a.anchorFactor==='rSPY'?.16:.20)*.6*scale;
        idioWalk+=gaussian(idioRng)*a.idioVol*scale*(symbol==='rTSLA'?.2:1);
      }
      const elapsed=ts-session.anchorCloseTs;
      const riskOff=SCENARIOS[1].impact*clamp((elapsed-session.windowDurationMs*SCENARIOS[1].progress)/(SCENARIOS[1].hoursDuration*HOUR));
      const market=marketWalk+riskOff;
      const sum=news.filter(n=>!n.preAnchor&&n.ts<=ts&&n.symbols.includes(symbol)).reduce((v,n)=>v+(n.impact??0),0);
      const newsReturn=.10*Math.tanh(sum/.10);
      const ghost=symbol==='rTSLA'&&this.ghostActive(session.anchorCloseTs)&&elapsed>=session.windowDurationMs*.62?.048:0;
      const quiet=['rAAPL','rMSFT','rJPM','rNVDA'].includes(symbol);
      const idio=(quiet?idioWalk*.12:idioWalk)+ghost;
      const logReturn=isAnchor(symbol)?market:a.beta*market+a.gamma*sectorWalk+newsReturn+idio;
      const volume=ts===session.anchorCloseTs?0:this.volumeRate(symbol,ts,session.anchorCloseTs)*STEP/HOUR;
      cumulativeVolume+=volume;
      expectedCumulativeVolume+=ts===session.anchorCloseTs?0:this.volumeRate(symbol,ts,session.anchorCloseTs,false)*STEP/HOUR;
      points.push({ts,price:anchor*Math.exp(logReturn),market,sector:sectorWalk,news:newsReturn,idio,volume,cumulativeVolume,expectedCumulativeVolume});
    }
    this.paths.set(key,points); return points;
  }
  async getQuotes(symbols: string[], asOf=this.clock()): Promise<{asOf:number;quotes:Quote[]}> {
    if(!Number.isFinite(asOf)) throw new ProviderError(this.id,'getQuotes','Invalid clock');
    const session=getSessionInfo(asOf);
    const quotes=symbols.filter(s=>this.anchors.some(a=>a.symbol===s)).map(symbol=>{
      const path=this.windowPath(symbol,session), point=path[Math.min(path.length-1,Math.floor((asOf-session.anchorCloseTs)/STEP))]!;
      let price=point.price;
      if(session.state==='regular') {
        const bar=this.bars(symbol,nyDate(asOf)).at(-1)!;
        const progress=clamp((asOf-atNy(nyDate(asOf),'09:30'))/(6.5*HOUR));
        price=bar.open*Math.exp(Math.log(bar.close/bar.open)*progress);
      }
      const spread=(!session.isDark?.0004:symbol==='rTSLA'?.0045:.0005);
      const from=asOf-24*HOUR;
      return {symbol,price,bid:price*(1-spread/2),ask:price*(1+spread/2),ts:asOf,
        volumeSinceClose:point.cumulativeVolume,volume24h:path.filter(p=>p.ts>=from&&p.ts<=asOf).reduce((v,p)=>v+p.volume,0)};
    });
    return {asOf,quotes};
  }
  async getWindowCandles(symbol: string, fromTs: number, intervalMinutes: 5|15|60): Promise<Candle[]> {
    this.config(symbol);
    if(!Number.isFinite(fromTs)||![5,15,60].includes(intervalMinutes)) throw new ProviderError(this.id,'getWindowCandles','Invalid candle request');
    const now=this.clock(), session=getSessionInfo(now), points=this.windowPath(symbol,session);
    const size=intervalMinutes/5, out:Candle[]=[];
    for(let i=0;i<points.length-1;i+=size) {
      const first=points[i]!; if(first.ts<fromTs||first.ts>=now) continue;
      const group=points.slice(i,Math.min(points.length,i+size+1)).filter(p=>p.ts<=now);
      const prices=group.map(p=>p.price);
      out.push({ts:first.ts,open:first.price,high:Math.max(...prices),low:Math.min(...prices),close:group.at(-1)!.price,volume:group.slice(1).reduce((v,p)=>v+p.volume,0)});
    }
    return out;
  }
}
