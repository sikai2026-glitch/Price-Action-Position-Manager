import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManagementPlan} from '../js/risk/management.js';

test('rejected entry still gets conditional management rules without executable quantities',()=>{
  const p=buildManagementPlan({side:'SHORT',entry:100,stop:110,targets:{finalTargets:[{price:85,rr:1.5},{price:75,rr:2.5},{price:65,rr:3.5}]},position:{qty:0,admissible:false},rules:{qtyStep:0.001},admissionStatus:'REJECTED'});
  assert.equal(p.status,'CONDITIONAL_ONLY');
  assert.equal(p.executionAllowed,false);
  assert.deepEqual(p.scaleOut.map(x=>x.allocationPct),[40,35,25]);
  assert.ok(p.scaleOut.every(x=>x.quantity===null));
  assert.match(p.earlyExit.trigger,/BULLISH_CHOCH/);
});

test('approved entry allocates partial exits and preserves remaining quantity for final target',()=>{
  const p=buildManagementPlan({side:'LONG',entry:100,stop:90,targets:{finalTargets:[{price:115,rr:1.5},{price:125,rr:2.5},{price:135,rr:3.5}]},position:{qty:1,admissible:true},rules:{qtyStep:0.01},admissionStatus:'APPROVED'});
  assert.equal(p.status,'READY');
  assert.equal(p.scaleOut[0].quantity,0.4);
  assert.equal(p.scaleOut[1].quantity,0.35);
  assert.equal(p.scaleOut[2].quantity,0.25);
});
