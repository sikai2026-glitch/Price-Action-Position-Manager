import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePosition,deriveStops,targets,evaluateAdmission} from '../js/risk/position.js';

test('position sizing respects risk budget, margin reserve and rounds quantity down',()=>{
  const p=calculatePosition({equity:70,riskPct:1,entry:100,stop:98,leverage:3,feeRate:0.0005,side:'LONG',rules:{qtyStep:0.01,minQty:0.01,minNotional:5,status:'TRADING'},marginUtilization:0.8});
  assert.equal(p.qty,0.33);assert.ok(p.totalStopCost<=p.riskBudget);assert.ok(p.reservedCapital<=p.capitalBudget);assert.equal(p.admissible,true);
});

test('structure stop only accepts an unbroken protective pivot on the correct side of entry',()=>{
  const structure={atr:10,lastClose:99,validLongStops:[{price:95,index:10,valid:true}],validShortStops:[{price:105,index:10,valid:true}]};
  assert.equal(deriveStops({side:'LONG',entry:100,structure,buffer:.2}).stop,93);
  assert.equal(deriveStops({side:'SHORT',entry:100,structure,buffer:.2}).stop,107);
  const invalid=deriveStops({side:'LONG',entry:100,structure:{...structure,validLongStops:[]},buffer:.2});
  assert.equal(invalid.valid,false);assert.equal(invalid.stop,null);
});

test('a pivot above the planned long entry is not a valid long stop anchor',()=>{
  const s={atr:100,recentLow:{price:62030.8},validLongStops:[]};
  const result=deriveStops({side:'LONG',entry:61850.1,structure:s,buffer:.2});
  assert.equal(result.valid,false);assert.match(result.reason,/没有找到入场价下方/);
});

test('invalid stop direction is rejected for manual stop',()=>{
  assert.equal(deriveStops({side:'LONG',entry:100,mode:'manual',manualStop:101}).valid,false);
});

test('R targets follow direction and structural obstacle is exposed separately',()=>{
  const long=targets({side:'LONG',entry:100,stop:98,structure:{pivots:{highs:[{index:4,price:104,time:4,valid:true}],lows:[]}}});
  const short=targets({side:'SHORT',entry:100,stop:102,structure:{pivots:{highs:[],lows:[{index:4,price:96,time:4,valid:true}]}}});
  assert.equal(long.rrTargets[0].price,103);assert.equal(short.rrTargets[0].price,97);
  assert.equal(long.structureTargets[0].price,104);assert.equal(long.finalTargets[0].price,103);assert.equal(long.finalTargets[1].price,104);assert.equal(long.finalTargets[1].source,'STRUCTURE');
});

test('position is rejected when exchange lot size makes minimum order exceed collateral reserve',()=>{
  const p=calculatePosition({equity:25,riskPct:1,entry:61850.1,stop:61809.36,leverage:3,feeRate:0.0005,side:'LONG',rules:{qtyStep:0.001,minQty:0.001,minNotional:50,status:'TRADING'},marginUtilization:0.8});
  assert.equal(p.admissible,false);assert.ok(p.checks.some(x=>/最小数量|最小值|仓位为0/.test(x)));
  assert.ok(p.reservedCapital<=p.capitalBudget+1e-8 || p.qty===0);
});

test('admission rejects opposite BOS and invalid stop',()=>{
  const result=evaluateAdmission({side:'LONG',structure:{trend:'BEARISH',event:'BEARISH_BOS'},stop:{valid:false,reason:'没有有效结构止损'},targets:{finalTargets:[]},position:null});
  assert.equal(result.status,'REJECTED');assert.ok(result.reasons.some(x=>/BEARISH_BOS/.test(x)));
});

test('minimum tradable lot exposes risk and margin feasibility instead of silently reporting zero size',()=>{
  const p=calculatePosition({equity:20,riskPct:1,entry:62000,stop:64277.5,leverage:3,feeRate:0.0005,side:'SHORT',rules:{qtyStep:0.001,minQty:0.001,minNotional:50,status:'TRADING'},marginUtilization:0.8,slippagePct:0.0002});
  assert.equal(p.qty,0);
  assert.equal(p.minimumOrder.qty,0.001);
  assert.ok(p.minimumOrder.stopCost>p.riskBudget);
  assert.equal(p.minimumOrder.fitsRisk,false);
  assert.equal(p.minimumOrder.fitsMargin,false);
  const a=evaluateAdmission({side:'SHORT',structure:{trend:'BEARISH',event:'BEARISH_BOS'},stop:{valid:true},targets:{finalTargets:[{rr:1.5}],warnings:[]},position:p});
  assert.equal(a.status,'REJECTED');
  assert.equal(a.marginSufficient,false);
});


test('U-margined futures sizing always calculates margin in USDT regardless of legacy market argument',()=>{
  const p=calculatePosition({equity:100,riskPct:1,entry:100,stop:95,leverage:5,feeRate:0,side:'LONG',rules:{qtyStep:0.001,minQty:0.001,minNotional:5,status:'TRADING'},market:'usdt_m_perpetual'});
  assert.equal(p.marginType,'USDT-M');
  assert.equal(p.marginAsset,'USDT');
  assert.ok(Math.abs(p.margin-p.notional/5)<1e-9);
});


test('structural target clips the R target when a confirmed pivot lies before it',()=>{
  const t=targets({side:'LONG',entry:100,stop:98,structure:{pivots:{highs:[{index:7,price:102.5,time:7,valid:true}],lows:[]}}});
  assert.equal(t.finalTargets[0].price,102.5);
  assert.equal(t.finalTargets[0].source,'STRUCTURE');
  assert.ok(t.finalTargets[0].rr<1.5);
});


test('short target ladder selects nearest valid support pivots and never emits negative prices',()=>{
  const t=targets({side:'SHORT',entry:0.243,stop:0.3214,structure:{pivots:{highs:[],lows:[
    {index:272,price:0.1924,time:272,valid:true},
    {index:241,price:0.1329,time:241,valid:true},
    {index:223,price:0.1121,time:223,valid:true},
    {index:217,price:0.1099,time:217,valid:true},
    {index:193,price:0.1006,time:193,valid:true},
    {index:205,price:0.1006,time:205,valid:true}
  ]}}});
  assert.deepEqual(t.finalTargets.map(x=>x.price),[0.1924,0.1329,0.1121]);
  assert.ok(t.finalTargets.every(x=>x.price>0));
  assert.ok(t.finalTargets[0].price>t.finalTargets[1].price&&t.finalTargets[1].price>t.finalTargets[2].price);
  assert.ok(t.warnings.some(x=>x.includes('3.5R'))===false);
});

test('non-positive R fallback is skipped when no positive structural target exists',()=>{
  const t=targets({side:'SHORT',entry:0.1,stop:0.2,structure:{pivots:{highs:[],lows:[]}}});
  assert.ok(t.finalTargets.every(x=>x.price>0));
  assert.ok(t.finalTargets.length<3);
  assert.ok(t.warnings.some(x=>x.includes('已跳过')));
});

test('spot sizing reserves full USDT notional and does not apply leverage',()=>{
  const p=calculatePosition({equity:100,riskPct:1,entry:10,stop:9,leverage:10,feeRate:0,side:'LONG',market:'spot'});
  assert.equal(p.marginType,'SPOT');
  assert.equal(p.leverage,1);
  assert.ok(Math.abs(p.margin-p.notional)<1e-9);
});
