import {atr,ema} from '../indicators/indicators.js';

/** Confirmed fractal pivots. A pivot is emitted only after `strength` right-side bars exist. */
export function findPivots(candles,strength=3){
  const highs=[],lows=[];
  for(let i=strength;i<candles.length-strength;i++){
    let isH=true,isL=true;
    for(let j=i-strength;j<=i+strength;j++){
      if(j===i)continue;
      if(candles[j].high>=candles[i].high)isH=false;
      if(candles[j].low<=candles[i].low)isL=false;
    }
    if(isH)highs.push({index:i,price:candles[i].high,time:candles[i].time});
    if(isL)lows.push({index:i,price:candles[i].low,time:candles[i].time});
  }
  return {highs,lows};
}
function classify(points,kind){
  if(points.length<2)return 'NA';
  const [a,b]=points.slice(-2);
  if(b.price===a.price)return 'EQ';
  if(kind==='high')return b.price>a.price?'HH':'LH';
  return b.price>a.price?'HL':'LL';
}
function annotateValidity(points,candles,kind){
  return points.map(p=>{
    const later=candles.slice(p.index+1);
    const breaker=kind==='low'
      ?later.find(c=>c.close<p.price)
      :later.find(c=>c.close>p.price);
    return {...p,valid:!breaker,invalidatedAt:breaker?.time??null,invalidatedClose:breaker?.close??null};
  });
}

export function analyzeStructure(candles,strength=3){
  if(!Array.isArray(candles)||candles.length<2*strength+30)throw new Error('K线数量不足，无法可靠识别结构');
  // API's final candle may still be forming. Exclude it from all structural calculations.
  const closed=candles.slice(0,-1);
  const piv=findPivots(closed,strength);
  const highs=annotateValidity(piv.highs,closed,'high');
  const lows=annotateValidity(piv.lows,closed,'low');
  const last=closed.at(-1),previous=closed.at(-2);
  const highClass=classify(highs,'high'),lowClass=classify(lows,'low');
  let trend='RANGE';
  if(highClass==='HH'&&lowClass==='HL')trend='BULLISH';
  else if(highClass==='LH'&&lowClass==='LL')trend='BEARISH';
  else if(highClass!=='NA'&&lowClass!=='NA')trend='MIXED';

  const recentHigh=highs.at(-1)||null,recentLow=lows.at(-1)||null;
  const priorHigh=highs.length>1?highs.at(-2):null;
  const priorLow=lows.length>1?lows.at(-2):null;
  let event='NONE';
  // A structure break is recognized on a close crossing the latest confirmed pivot.
  if(recentHigh&&previous.close<=recentHigh.price&&last.close>recentHigh.price)
    event=trend==='BEARISH'?'BULLISH_CHOCH':'BULLISH_BOS';
  else if(recentLow&&previous.close>=recentLow.price&&last.close<recentLow.price)
    event=trend==='BULLISH'?'BEARISH_CHOCH':'BEARISH_BOS';

  const validLows=lows.filter(p=>p.valid);
  const validHighs=highs.filter(p=>p.valid);
  const validLongStops=validLows.filter(p=>p.price<last.close).sort((a,b)=>b.index-a.index);
  const validShortStops=validHighs.filter(p=>p.price>last.close).sort((a,b)=>b.index-a.index);
  const support=validLongStops.slice().sort((a,b)=>b.price-a.price)[0]||null;
  const resistance=validShortStops.slice().sort((a,b)=>a.price-b.price)[0]||null;
  const a=atr(closed,14);
  const closes=closed.map(c=>c.close);
  const e20=ema(closes,20).at(-1),e50=ema(closes,50).at(-1);

  let sweep='NONE';
  if(priorLow&&last.low<priorLow.price&&last.close>priorLow.price)sweep='BULLISH_SWEEP';
  if(priorHigh&&last.high>priorHigh.price&&last.close<priorHigh.price)sweep='BEARISH_SWEEP';

  return {
    trend,event,highClass,lowClass,atr:a,ema20:e20,ema50:e50,
    lastClose:last.close,lastCandle:last,previousCandle:previous,
    recentLow,recentHigh,support,resistance,
    validLongStops,validShortStops,
    invalidatedLows:lows.filter(p=>!p.valid),invalidatedHighs:highs.filter(p=>!p.valid),
    pivots:{highs,lows},sweep,closedBars:closed.length,calculationBars:closed.length,
    dataTime:last.closeTime??last.time
  };
}
