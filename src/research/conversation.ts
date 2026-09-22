import type {Instrument} from '../../engine/types.js';
/** Carry only explicitly selected symbols, never prior model prose or private holdings. */
export function contextualQuestion(question:string,previous:string[],universe:Instrument[]){
 const explicit=universe.filter(i=>new RegExp(`\\b(?:${i.symbol}|${i.underlying})\\b`,'i').test(question)).map(i=>i.symbol);
 const broad=/\b(scan|market|board|all names|everything)\b/i.test(question);
 const symbols=explicit.length?explicit:broad?[]:previous;
 return {symbols,question:explicit.length||!symbols.length?question:`${question}\nInstrument context: ${symbols.join(', ')}`};
}
