import test from 'node:test';import assert from 'node:assert/strict';import {findPivots} from '../js/price-action/structure.js';
test('pivot confirmation requires right-side bars',()=>{const c=[{high:1,low:0},{high:2,low:1},{high:5,low:2},{high:3,low:1},{high:2,low:0}];const p=findPivots(c,2);assert.equal(p.highs.length,1);assert.equal(p.highs[0].index,2)});
