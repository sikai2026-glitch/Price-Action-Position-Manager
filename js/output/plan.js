export function makePlan({market,symbol,timeframe,side,entry,live,mark,equity,riskPct,leverage,structure,stop,targets,position,rules,admission,assumptions}){
  return {
    app:'PA Position Manager',version:'1.0.1',generatedAt:new Date().toISOString(),
    market:{type:market,symbol,timeframe,livePrice:live,markPrice:mark,dataTime:structure?.dataTime??null},
    trade:{side,plannedEntry:entry,accountEquity:equity,riskPct,leverage},
    priceAction:structure?{
      trend:structure.trend,structureEvent:structure.event,highClass:structure.highClass,lowClass:structure.lowClass,
      liquiditySweep:structure.sweep,atr14:structure.atr,ema20:structure.ema20,ema50:structure.ema50,
      lastClosedPrice:structure.lastClose,recentSwingHigh:structure.recentHigh,recentSwingLow:structure.recentLow,
      validLongStops:structure.validLongStops,validShortStops:structure.validShortStops,
      invalidatedLows:structure.invalidatedLows,invalidatedHighs:structure.invalidatedHighs,
      support:structure.support,resistance:structure.resistance,closedBars:structure.closedBars,dataTime:structure.dataTime
    }:null,
    risk:{stop,targets,position,exchangeRules:rules?{
      status:rules.status,minQty:rules.minQty,qtyStep:rules.qtyStep,minNotional:rules.minNotional,
      priceTick:rules.priceTick,contractType:rules.contractType
    }:null,assumptions},
    admission,
    disclaimer:'Analysis and calculation only. No order execution. Recheck current exchange rules, mark price, fees, funding, slippage and margin tiers before trading.'
  };
}
