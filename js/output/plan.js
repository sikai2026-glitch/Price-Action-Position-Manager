export function makePlan({market,symbol,timeframe,side,entry,live,mark,equity,riskPct,leverage,structure,stop,targets,position,rules,admission,management,assumptions}){
  return {
    app:'PA Position Manager',version:'1.0.4',generatedAt:new Date().toISOString(),
    market:{type:market==='spot'?'SPOT':market==='tradfi'?'TRADFI_PERPETUAL':'USDⓈ-M_PERPETUAL',marginType:market==='spot'?'SPOT':market==='tradfi'?'TRADFI':'USDT-M',marginAsset:'USDT',settlementAsset:'USDT',symbol,timeframe,livePrice:live,markPrice:mark,dataTime:structure?.dataTime??null},
    trade:{side,plannedEntry:entry,accountEquity:equity,equityUnit:'USDT',riskPct,leverageInput:leverage,leverageApplied:position?.leverage??leverage,leverageUnit:'x'},
    priceAction:structure?{
      trend:structure.trend,structureEvent:structure.event,highClass:structure.highClass,lowClass:structure.lowClass,
      liquiditySweep:structure.sweep,atr14:structure.atr,ema20:structure.ema20,ema50:structure.ema50,
      lastClosedPrice:structure.lastClose,recentSwingHigh:structure.recentHigh,recentSwingLow:structure.recentLow,
      validLongStops:structure.validLongStops,validShortStops:structure.validShortStops,
      invalidatedLows:structure.invalidatedLows,invalidatedHighs:structure.invalidatedHighs,
      support:structure.support,resistance:structure.resistance,closedBars:structure.closedBars,dataTime:structure.dataTime
    }:null,
    risk:{stop,targets,position,management,exchangeRules:rules?{
      status:rules.status,minQty:rules.minQty,qtyStep:rules.qtyStep,minNotional:rules.minNotional,
      priceTick:rules.priceTick,contractType:rules.contractType,quoteAsset:rules.quoteAsset,marginAsset:rules.marginAsset,settlementAsset:rules.settlementAsset
    }:null,assumptions},
    admission,
    disclaimer:'Supports USDT-quoted Binance USDⓈ-M perpetual, Spot and TradFi perpetual (default: USDⓈ-M). COIN-M is not supported. Analysis and calculation only; no order execution. Spot uses full-notional capital, while TradFi exchange rules may require manual verification. Recheck exchange rules, mark price, fees, funding, slippage and margin tiers before trading.'
  };
}
