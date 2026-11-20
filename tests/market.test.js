import test from 'node:test';
import assert from 'node:assert/strict';
import {assertUsdtMSymbol,assertUsdtMContractRow} from '../js/api/binance.js';

test('only USDT-suffixed symbols pass the USDT-M symbol gate',()=>{
  assert.doesNotThrow(()=>assertUsdtMSymbol('BTCUSDT'));
  assert.doesNotThrow(()=>assertUsdtMSymbol('1000PEPEUSDT'));
  assert.throws(()=>assertUsdtMSymbol('BTCUSD_PERP'),/币本位合约不支持/);
  assert.throws(()=>assertUsdtMSymbol('BTCUSDC'),/USDT/);
});

test('exchange metadata must confirm USDT quote, USDT margin and standard perpetual contract',()=>{
  assert.equal(assertUsdtMContractRow('BTCUSDT',{quoteAsset:'USDT',marginAsset:'USDT',contractType:'PERPETUAL'}),true);
  assert.throws(()=>assertUsdtMContractRow('BTCUSD_PERP',{quoteAsset:'USD',marginAsset:'BTC',contractType:'PERPETUAL'}),/不是标准 USDT-M/);
  assert.throws(()=>assertUsdtMContractRow('BTCUSDT',{quoteAsset:'USDT',marginAsset:'USDT',contractType:'CURRENT_QUARTER'}),/不是标准 USDT-M/);
});
