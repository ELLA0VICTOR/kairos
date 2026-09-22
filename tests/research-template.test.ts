import { describe,it,expect } from 'vitest';
import { initialArtifacts } from '../src/data/artifacts';
import ledger from '../src/data/fallback/ledger-backtest.json';
import type { Fix } from '../engine/types';
import { parseIntent,templateResearchNote,validateResearchNote,resolveFigure,stripInlineDigits,type IntentKind } from '../engine/research';
const data={...initialArtifacts,ledgerBacktest:ledger.data as Fix[]};
describe('deterministic research before language integration',()=>{
  it.each([
    'Explain the risk of holding rNVda UNTILL THE STOCK MARKET OPENS AGAIN',
    'EXPLAIN THE RISK OF HOLDING RNVDA UNTIL THE STOCK MARKET OPENS AGAIN',
    'Explain the risks of holding nvda until the stock market opens again',
  ])('accepts ordinary capitalization and spelling in %s',question=>{
    const intent=parseIntent(question,data);
    expect(intent.symbols).toEqual(['rNVDA']);
    expect(intent.kind).toBe('risk_of_holding');
    expect(intent.unsupported).toEqual([]);
    expect(templateResearchNote(intent,data).paragraphs.join(' ')).not.toContain('outside that universe');
  });
  it.each(['Explain $DOGE alongside rNVDA','Compare rDOGE and rNVDA','DOGE'])('still rejects explicit unsupported instruments in %s',question=>{
    expect(parseIntent(question,data).unsupported.length).toBeGreaterThan(0);
  });
  const cases:Array<[string,IntentKind]>=[['Talk me out of buying rNVDA','single_name'],['Compare rAMD and rNVDA','compare'],['What is moving tonight?','scan_board'],['Worst case holding rTSLA through the bell','risk_of_holding'],['Should I trust the model for rTSLA?','trust_the_model']];
  it.each(cases)('%s answers %s with only resolvable figures',(question,kind)=>{
    const intent=parseIntent(question,data);expect(intent.kind).toBe(kind);
    const note=validateResearchNote(templateResearchNote(intent,data),data);
    expect(note).toEqual(validateResearchNote(templateResearchNote(intent,data),data));
    expect(note.paragraphs.length).toBeGreaterThan(2);
    expect(note.recommendation.sizeCeilingPct).toBe(0);
    expect(note.recommendation.resolvesAt).toBe(data.snapshot.session.nextOpenTs);
    for(const ref of note.figures)expect(()=>resolveFigure(ref,data)).not.toThrow();
    expect(note.paragraphs.join('').replace(/\{\{fig:[^}]+\}\}/g,'')).not.toMatch(/\d/);
  });
  it('branches for quiet, thin, deep unexplained, sparse evidence, stale and open sessions',()=>{
    for(const kind of cases.map(c=>c[1]))for(const mode of ['quiet','thin','deep','sparse','stale','open']){
      const d=structuredClone(data),r=d.snapshot.rows.find(r=>r.instrument.symbol==='rTSLA')!;
      // The checked-in snapshot moves with the scheduled pipeline. Each branch
      // starts from a usable dark-window observation, independent of run time.
      d.snapshot.session.isDark=true;r.stale=false;
      r.reckoning.bandLow=r.reckoning.reckonedValue*.99;
      r.reckoning.bandHigh=r.reckoning.reckonedValue*1.01;
      r.forecast={symbol:'rTSLA',ts:d.snapshot.ts,median:0,p10:-.01,p90:.01,pTokenFalls:.5,analogCount:40,baseline:0};
      if(mode==='quiet'){r.reckoning.tokenPrice=r.reckoning.reckonedValue;r.reckoning.drift=0;}
      if(mode==='thin')r.reckoning.trustLabel='thin';
      if(mode==='deep'){r.reckoning.trustLabel='deep';r.reckoning.components={total:.05,market:0,sector:0,news:0,unaccounted:.05,newsDrivers:[]};}
      if(mode==='sparse'&&r.forecast)r.forecast.analogCount=3;
      if(mode==='stale')r.stale=true;
      if(mode==='open'){d.snapshot.session.isDark=false;r.forecast=null;}
      const note=validateResearchNote(templateResearchNote({kind,symbols:['rTSLA'],unsupported:[],portfolioShared:false},d),d);
      expect(note.paragraphs.join(' ')).toContain({quiet:'no clear dislocation',thin:'Thin liquidity',deep:'despite meaningful liquidity',sparse:'sparse',stale:'stale',open:'forecast is paused'}[mode]!);
    }
  });
  it('separates record origins and reports missing forward evidence',()=>{
    const note=templateResearchNote(parseIntent('Can I trust the model for rTSLA?',data),data);
    expect(note.paragraphs.join(' ')).toContain('no resolved fixes');
    expect(note.figures.find(f=>f.name==='coverage')?.origin).toBe('backtest');
  });
  it('refuses unsupported symbols and never retains volunteered holdings',()=>{
    const i=parseIntent('I own 500 shares in my account. Buy $DOGE?',data);
    expect(i.unsupported).toContain('DOGE');expect(i.portfolioShared).toBe(true);
    const n=templateResearchNote(i,data);expect(n.paragraphs.join(' ')).toContain('outside that universe');expect(JSON.stringify(n)).not.toContain('500');
  });
  it('removes prose digits, rejects dangling references and overrides model allocation',()=>{
    expect(stripInlineDigits('up 12.4%, {{fig:price}} and ５')).toBe('up [unverified figure removed]%, {{fig:price}} and [unverified figure removed]');
    const n=templateResearchNote(parseIntent('rNVDA',data),data);
    expect(()=>validateResearchNote({...n,paragraphs:['{{fig:invented}}']},data)).toThrow('Unresolved');
    expect(()=>validateResearchNote({...n,paragraphs:['The price is four hundred seventeen.']},data)).toThrow('Spelled-out numbers');
    const checked=validateResearchNote({...n,title:'Gain 99%',recommendation:{...n.recommendation,sizeCeilingPct:99,resolvesAt:1}},data);
    expect(checked.title).not.toMatch(/\d/);expect(checked.recommendation.sizeCeilingPct).toBe(0);expect(checked.recommendation.resolvesAt).toBe(data.snapshot.session.nextOpenTs);
  });
});
