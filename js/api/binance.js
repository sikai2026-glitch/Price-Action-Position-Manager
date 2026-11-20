import {CONFIG} from '../config.js';
import {getFirst,query} from './http.js';
const fut=(p)=>CONFIG.futuresBases.map(b=>query(b,p.path,p.params));
let futuresInfoCache=null;
export async function loadFuturesInfo(){
  if(!futuresInfoCache)futuresInfoCache=getFirst(fut({path:'/fapi/v1/exchangeInfo'})).catch(e=>{futuresInfoCache=null;throw e});
  return futuresInfoCache;
}
export function assertUsdtMSymbol(symbol){
  if(!/^[A-Z0-9]{2,}USDT$/.test(symbol))throw new Error('仅支持 U 本位 USDT 结算永续合约，请使用 BTCUSDT、ETHUSDT 等 USDT 交易对；币本位合约不支持');
}
export function assertUsdtMContractRow(symbol,row){
  const marginAsset=row?.marginAsset||row?.quoteAsset;
  if(!row||row.quoteAsset!=='USDT'||marginAsset!=='USDT'||row.contractType!=='PERPETUAL')throw new Error(`${symbol} 不是标准 USDT-M 永续合约（要求 quoteAsset=USDT、marginAsset=USDT、contractType=PERPETUAL），已拒绝使用`);
  return true;
}
export async function getTicker(_market,symbol){
  assertUsdtMSymbol(symbol);
  const [ticker,mark,day]=await Promise.all([
    getFirst(fut({path:'/fapi/v1/ticker/price',params:{symbol}})),
    getFirst(fut({path:'/fapi/v1/premiumIndex',params:{symbol}})).catch(()=>null),
    getFirst(fut({path:'/fapi/v1/ticker/24hr',params:{symbol}})).catch(()=>null)
  ]);
  return {price:+ticker.price,markPrice:mark?+mark.markPrice:null,indexPrice:mark?+mark.indexPrice:null,fundingRate:mark?+mark.lastFundingRate:null,changePct:day?+day.priceChangePercent:null,source:'Binance USDⓈ-M Futures ticker',marginType:'USDT-M',marginAsset:'USDT'};
}
export async function getKlines({market: _market,symbol,interval,limit=300}){
  assertUsdtMSymbol(symbol);
  const data=await getFirst(fut({path:'/fapi/v1/klines',params:{symbol,interval,limit}}));
  return data.map(k=>({time:+k[0],open:+k[1],high:+k[2],low:+k[3],close:+k[4],volume:+k[5],closeTime:+k[6],quoteVolume:+k[7],trades:+k[8],takerBuyBase:+k[9],takerBuyQuote:+k[10]}));
}
export async function getSymbolRules(_market,symbol){
  assertUsdtMSymbol(symbol);
  const info=await loadFuturesInfo();
  const row=info.symbols?.find(s=>s.symbol===symbol);
  assertUsdtMContractRow(symbol,row);
  const marginAsset=row.marginAsset||row.quoteAsset;
  const filters=Object.fromEntries((row.filters||[]).map(f=>[f.filterType,f]));
  return {status:row.status,baseAsset:row.baseAsset,quoteAsset:row.quoteAsset,marginAsset,settlementAsset:marginAsset,marginType:'USDT-M',contractType:row.contractType||'PERPETUAL',priceTick:+(filters.PRICE_FILTER?.tickSize||0),qtyStep:+(filters.LOT_SIZE?.stepSize||filters.MARKET_LOT_SIZE?.stepSize||0),minQty:+(filters.LOT_SIZE?.minQty||filters.MARKET_LOT_SIZE?.minQty||0),minNotional:+(filters.MIN_NOTIONAL?.notional||filters.NOTIONAL?.minNotional||filters.MIN_NOTIONAL?.minNotional||0),raw:row};
}
export async function getOpenInterest(symbol){assertUsdtMSymbol(symbol);try{const d=await getFirst(fut({path:'/fapi/v1/openInterest',params:{symbol}}));return +d.openInterest}catch{return null}}
export async function getFunding(symbol){assertUsdtMSymbol(symbol);try{const d=await getFirst(fut({path:'/fapi/v1/premiumIndex',params:{symbol}}));return +d.lastFundingRate}catch{return null}}
