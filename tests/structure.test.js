import test from 'node:test';
import assert from 'node:assert/strict';
import {findPivots,analyzeStructure} from '../js/price-action/structure.js';

test('pivot confirmation requires right-side bars',()=>{
  const c=[{high:1,low:0},{high:2,low:1},{high:5,low:2},{high:3,low:1},{high:2,low:0}];
  const p=findPivots(c,2);assert.equal(p.highs.length,1);assert.equal(p.highs[0].index,2);
});

test('pivots are marked invalid after a later closing break',()=>{
  const candles=[];
  for(let i=0;i<45;i++){
    const base=100+Math.sin(i/2)*3;
    candles.push({time:i,open:base,high:base+2,low:base-2,close:base,closeTime:i});
  }
  // Force a confirmed local low, then a later close through it.
  candles[20]={time:20,open:90,high:92,low:80,close:90,closeTime:20};
  candles[21]={time:21,open:91,high:94,low:88,close:92,closeTime:21};
  candles[22]={time:22,open:92,high:95,low:89,close:93,closeTime:22};
  candles[23]={time:23,open:93,high:94,low:87,close:90,closeTime:23};
  candles[24]={time:24,open:89,high:91,low:85,close:86,closeTime:24};
  candles[25]={time:25,open:82,high:84,low:76,close:78,closeTime:25};
  const result=analyzeStructure(candles,2);
  assert.ok(result.invalidatedLows.some(p=>p.index===20));
  assert.ok(!result.validLongStops.some(p=>p.index===20));
});

