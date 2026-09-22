import {expect,test} from 'vitest';
import {contextualQuestion} from '../src/research/conversation';
import {UNIVERSE} from '../src/data/providers/anchors';
test('follow-ups carry only instrument context and explicit symbols replace it',()=>{
 expect(contextualQuestion('What about the risk?',['rNVDA'],UNIVERSE)).toEqual({symbols:['rNVDA'],question:'What about the risk?\nInstrument context: rNVDA'});
 expect(contextualQuestion('Explain TSLA',['rNVDA'],UNIVERSE).symbols).toEqual(['rTSLA']);
 expect(contextualQuestion('Scan the board',['rNVDA'],UNIVERSE).symbols).toEqual([]);
});
