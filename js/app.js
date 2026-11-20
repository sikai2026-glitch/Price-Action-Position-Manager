import {getTicker,getKlines,getSymbolRules} from './api/binance.js';
import {analyzeStructure} from './price-action/structure.js';
import {deriveStops,targets,calculatePosition,evaluateAdmission,roundDown} from './risk/position.js';
import {makePlan} from './output/plan.js';
import {buildManagementPlan} from './risk/management.js';

const $=id=>document.getElementById(id);
let ticker=null,structure=null,rules=null,lastPlan=null;
const fmt=(v,n=6)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?(+v).toLocaleString('en-US',{maximumFractionDigits:n}):'—';
const market=()=>$('marketType').value;
const symbol=()=>$('symbol').value.trim().toUpperCase();
const timeframe=()=>$('timeframe').value;
const interval=tf=>tf;
function setStatus(ok,msg){$('apiDot').style.background=ok?'#36c996':'#ff7185';$('apiStatus').textContent=msg}
function roundPrice(value,side,kind='stop'){
  const tick=rules?.priceTick||0;if(!tick)return value;
  const units=value/tick;
  const roundDownForLongStop=kind==='stop'&&side==='LONG';
  const roundUpForShortStop=kind==='stop'&&side==='SHORT';
  const roundDownForLongTarget=kind==='target'&&side==='LONG';
  const roundUpForShortTarget=kind==='target'&&side==='SHORT';
  const rounded=(roundDownForLongStop||roundDownForLongTarget)?Math.floor(units+1e-10)*tick:
    (roundUpForShortStop||roundUpForShortTarget)?Math.ceil(units-1e-10)*tick:Math.round(units)*tick;
  return +rounded.toFixed(Math.max(0,Math.ceil(-Math.log10(tick))+4));
}
function setResult(id,value){$(id).textContent=value??'—'}

async function refresh(){
  const s=symbol();if(!s)throw new Error('请填写交易品种');
  setStatus(false,'正在获取行情');
  const apiMarket=market()==='spot'?'spot':'futures';
  ticker=await getTicker(apiMarket,s);
  setResult('livePrice',fmt(ticker.price,8));setResult('markPrice',ticker.markPrice?fmt(ticker.markPrice,8):'不适用');
  setResult('change24h',ticker.changePct===null?'—':`${ticker.changePct>=0?'+':''}${fmt(ticker.changePct,2)}%`);
  $('change24h').style.color=ticker.changePct===null?'#91a2ba':ticker.changePct>=0?'#36c996':'#ff7185';
  $('priceMeta').textContent=`来源：${ticker.source} · ${new Date().toLocaleTimeString()}`;
  $('marketMeta').textContent=market()==='spot'?'Spot':market()==='tradfi'?'TRADIFI_PERPETUAL':'USDⓈ-M PERPETUAL';
  $('marketHint').textContent=market()==='tradfi'?'TradFi价格与K线按TRADIFI_PERPETUAL合约类型获取；交易时段、指数及标记价格机制可能不同。':'公开行情，无需API Key。实时价格仅供参考；计划入场价由你手动填写。';
  rules=await getSymbolRules(apiMarket,s).catch(()=>null);
  setStatus(true,'行情已更新');return ticker;
}

async function analyze(){
  const s=symbol();$('analysisMeta').textContent='正在获取K线…';
  const candles=await getKlines({market:market(),symbol:s,interval:interval(timeframe()),limit:300});
  structure=analyzeStructure(candles,+$('pivotStrength').value);const x=structure;
  $('structureState').textContent=x.trend==='BULLISH'?'上升结构':x.trend==='BEARISH'?'下降结构':x.trend==='MIXED'?'混合结构':'震荡 / 未确认';
  $('structureDetail').textContent=`摆动高点 ${x.highClass} · 摆动低点 ${x.lowClass}`;
  $('trendState').textContent=x.ema20>x.ema50?'均线偏多':x.ema20<x.ema50?'均线偏空':'均线中性';
  $('trendDetail').textContent=`EMA20 ${fmt(x.ema20)} / EMA50 ${fmt(x.ema50)}`;
  $('breakState').textContent=({BULLISH_BOS:'看涨 BOS',BEARISH_BOS:'看跌 BOS',BULLISH_CHOCH:'看涨 CHoCH',BEARISH_CHOCH:'看跌 CHoCH',NONE:'未发现最新收盘确认突破'})[x.event];
  $('breakDetail').textContent=`流动性扫荡：${x.sweep==='NONE'?'未发现':x.sweep==='BULLISH_SWEEP'?'看涨扫荡':'看跌扫荡'}`;
  setResult('atrValue',fmt(x.atr));$('atrPct').textContent=`ATR / Close ${(x.atr/x.lastClose*100).toFixed(2)}%`;
  setResult('swingHigh',x.recentHigh?fmt(x.recentHigh.price):'—');setResult('swingLow',x.recentLow?fmt(x.recentLow.price):'—');
  setResult('support',x.support?fmt(x.support.price):'—');setResult('resistance',x.resistance?fmt(x.resistance.price):'—');
  $('structureNote').textContent=`基于 ${x.closedBars} 根已收盘K线。摆动点会检查形成后的收盘价是否破坏；有效保护低点/高点分别用于多/空止损。未实现OB/FVG自动确认。`;
  $('analysisMeta').textContent=`分析完成 · ${candles.length}根K线 · ${new Date().toLocaleTimeString()}`;
}

function calc(){
  const entry=+$('entry').value;if(!(entry>0))throw new Error('请填写有效的计划入场价');
  if(!structure&&$('stopMode').value!=='manual')throw new Error('请先获取K线并分析价格结构');
  const side=$('side').value,mode=$('stopMode').value;
  let stopObj=deriveStops({side,entry,structure,buffer:+$('atrBuffer').value,mode,manualStop:+$('manualStop').value||null});
  if(stopObj.valid){
    stopObj.stop=roundPrice(stopObj.stop,side,'stop');
    stopObj.distance=Math.abs(entry-stopObj.stop);stopObj.distancePct=stopObj.distance/entry;
    stopObj.atrRatio=structure?.atr>0?stopObj.distance/structure.atr:null;
    if(side==='LONG'&&stopObj.stop>=entry||side==='SHORT'&&stopObj.stop<=entry){stopObj={...stopObj,valid:false,stop:null,reason:'按交易所价格精度取整后，止损方向无效'};}
  }
  let targetSet={rrTargets:[],structureTargets:[],finalTargets:[],warnings:[]};
  let position=null;
  if(stopObj.valid){
    targetSet=targets({side,entry,stop:stopObj.stop,structure,manualTp1:+$('manualTp1').value||null,manualTp2:+$('manualTp2').value||null});
    targetSet.rrTargets=targetSet.rrTargets.map(t=>({...t,price:roundPrice(t.price,side,'target'),rr:Math.abs(roundPrice(t.price,side,'target')-entry)/stopObj.distance}));
    targetSet.structureTargets=targetSet.structureTargets.map(t=>({...t,price:roundPrice(t.price,side,'target'),rr:Math.abs(roundPrice(t.price,side,'target')-entry)/stopObj.distance}));
    targetSet.finalTargets=targetSet.finalTargets.map(t=>({...t,price:roundPrice(t.price,side,'target'),rr:Math.abs(roundPrice(t.price,side,'target')-entry)/stopObj.distance}));
    position=calculatePosition({
      equity:+$('equity').value,riskPct:+$('riskPct').value,entry,stop:stopObj.stop,
      leverage:+$('leverage').value,feeRate:+$('feeRate').value,side,rules,market:market(),
      marginUtilization:+$('marginUtilization').value,slippagePct:+$('slippagePct').value/100,
      fundingPct:+$('fundingPct').value/100
    });
  }
  const admission=evaluateAdmission({side,structure,stop:stopObj,targets:targetSet,position});
  const live=ticker?.price??null;
  const entryDriftPct=live&&entry>0?Math.abs(entry-live)/live:null;
  if(entryDriftPct!==null&&entryDriftPct>0.005)admission.warnings.push(`计划入场价与实时价偏离 ${(entryDriftPct*100).toFixed(2)}%，请重新确认挂单位置`);
  if(!rules)admission.warnings.push('未获取到交易所过滤器，数量步长/最小下单金额尚未验证');
  if(admission.status!=='REJECTED'&&admission.warnings.length)admission.status='CAUTION';
  const management=buildManagementPlan({side,entry,stop:stopObj.valid?stopObj.stop:null,targets:targetSet,position,rules,admissionStatus:admission.status});

  setResult('stopOut',stopObj.valid?fmt(stopObj.stop,8):'无有效止损');
  $('stopReason').textContent=stopObj.reason+(stopObj.warnings?.length?`；${stopObj.warnings.join('；')}`:'');
  targetSet.finalTargets.forEach((t,i)=>{setResult(`tp${i+1}Out`,fmt(t.price,8));setResult(`tp${i+1}RR`,`风险收益比 ${t.rr.toFixed(2)}R${t.source==='STRUCTURE_CLIPPED'?' · 结构阻挡':''}`)});
  if(!stopObj.valid){['tp1Out','tp2Out','tp3Out','tp1RR','tp2RR','tp3RR'].forEach(id=>setResult(id,'—'));}
  setResult('riskOut',position?`${fmt(position.riskBudget,4)} USDT`:'—');
  setResult('notionalOut',position?(position.admissible?`${fmt(position.notional,4)} USDT`:'不可执行'):'—');
  setResult('marginOut',position?(position.admissible?(market()==='spot'?'全额现货资金':`${fmt(position.margin,4)} USDT`):'不可执行'):'—');
  setResult('qtyOut',position?(position.admissible?fmt(position.qty,8):'不可执行'):'—');
  setResult('distanceOut',stopObj.valid?`${fmt(stopObj.distance,8)} (${(stopObj.distancePct*100).toFixed(3)}%)`:'—');
  setResult('lossOut',position?(position.admissible?`${fmt(position.totalStopCost,4)} USDT`:'不可执行'):'—');

  const admissionEl=$('admission');
  admissionEl.className=`admission ${admission.status==='REJECTED'?'bad':admission.status==='CAUTION'?'warn':'good'}`;
  admissionEl.textContent=`${admission.status}：${[...admission.reasons,...admission.warnings].join('；')||'结构与基础风险检查通过'}`;
  const rows=[
    ['止损依据',stopObj.reason,'结构锚点必须有效且未被收盘价破坏'],
    ['结构止盈',targetSet.structureTargets.map(t=>`${fmt(t.price,8)} (${t.rr.toFixed(2)}R)`).join(' / ')||'未发现','基于入场方向前方已确认摆动点'],
    ['毛止损损失',position?`${fmt(position.grossStopLoss,4)} USDT`:'—','不含交易成本'],
    ['开仓手续费',position?`${fmt(position.estimatedOpenFee,4)} USDT`:'—','按单边费率估算'],
    ['平仓手续费',position?`${fmt(position.estimatedCloseFee,4)} USDT`:'—','按入场名义价值近似估算'],
    ['滑点预留',position?`${fmt(position.estimatedSlippage,4)} USDT`:'—','按往返滑点总比例估算'],
    ['资金费率预留',position?`${fmt(position.estimatedFunding,4)} USDT`:'—','按用户填写的持仓期间总比例估算'],
    ['保证金及预留成本',position?`${fmt(position.reservedCapital,4)} USDT`:'—',`可用预算 ${fmt(position?.capitalBudget,4)} USDT`],
    ['交易所最小名义价值',rules?.minNotional?`${rules.minNotional} USDT`:'未知','以实际交易对规则为准'],
    ['最小可交易数量',position?.minimumOrder?.qty!==null&&position?.minimumOrder?.qty!==undefined?fmt(position.minimumOrder.qty,8):'未知','按最小数量与最小名义价值、数量步长计算'],
    ['最小仓位预计止损成本',position?.minimumOrder?.stopCost!==null&&position?.minimumOrder?.stopCost!==undefined?`${fmt(position.minimumOrder.stopCost,4)} USDT`:'未知',`当前风险预算 ${fmt(position?.riskBudget,4)} USDT`],
    ['满足最小交易单位所需权益',position?.minimumOrder?.requiredEquity!==null&&position?.minimumOrder?.requiredEquity!==undefined?`${fmt(position.minimumOrder.requiredEquity,2)} USDT`:'未知','同时考虑风险预算和保证金预留的估算值，不是加资建议'],
    ['数量步长',rules?.qtyStep??'未知','按交易所 LOT_SIZE 过滤器'],
    ['实时价格',ticker?fmt(ticker.price,8):'未获取','不替代计划入场价'],
    ['标记价格',ticker?.markPrice?fmt(ticker.markPrice,8):'不适用','合约风险参考之一']
  ];
  $('detailRows').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
  const managementEl=$('managementOut');
  managementEl.className=`management ${management.executionAllowed?'ready':'conditional'}`;
  managementEl.innerHTML=`<p><strong>${management.status==='READY'?'可执行管理模板':management.status==='READY_WITH_CAUTION'?'管理模板可用 · 先核实警告':'条件式管理模板 · 当前不可开仓'}</strong></p><p>${management.explanation}</p><div class="management-grid">${management.scaleOut.map(x=>`<article><small>${x.name} · ${x.allocationPct}%</small><strong>${x.price===null?'未生成':fmt(x.price,8)}</strong><span>${x.rr===null?'—':`${x.rr.toFixed(2)}R`} · ${x.quantity===null?'无可执行数量':`${fmt(x.quantity,8)} 数量`}</span><p>${x.action}</p></article>`).join('')}</div><ul><li>TP1后：${management.protectionAfterTP1.action}（参考价 ${fmt(management.protectionAfterTP1.illustrativeStop,8)}，实际需覆盖费用）</li><li>TP2后：${management.protectionAfterTP2.action}</li><li>提前退出：${management.earlyExit.trigger}；${management.earlyExit.action}</li><li>计划失效：${management.invalidation.trigger}；${management.invalidation.action}</li></ul><p>${management.operatingRules.join('；')}</p>`;
  lastPlan=makePlan({market:market(),symbol:symbol(),timeframe:timeframe(),side,entry,live,mark:ticker?.markPrice??null,equity:+$('equity').value,riskPct:+$('riskPct').value,leverage:+$('leverage').value,structure,stop:stopObj,targets:targetSet,position,rules,admission,management,assumptions:{feeRatePerSide:+$('feeRate').value,slippagePct:+$('slippagePct').value/100,fundingPct:+$('fundingPct').value/100,marginUtilization:+$('marginUtilization').value}});
  $('copyBtn').disabled=false;$('downloadBtn').disabled=false;return lastPlan;
}

function showError(e){setStatus(false,'行情或计算异常');$('admission').className='admission bad';$('admission').textContent=e.message||String(e)}
$('refreshBtn').addEventListener('click',()=>refresh().catch(showError));
$('analyzeBtn').addEventListener('click',()=>analyze().catch(showError));
$('calculateBtn').addEventListener('click',()=>{try{calc()}catch(e){showError(e)}});
$('useLiveBtn').addEventListener('click',()=>{if(!ticker){showError(new Error('请先刷新行情'));return}$('entry').value=ticker.price});
$('resetBtn').addEventListener('click',()=>{['entry','manualStop','manualTp1','manualTp2'].forEach(id=>$(id).value='');lastPlan=null;$('copyBtn').disabled=true;$('downloadBtn').disabled=true;$('admission').className='admission neutral';$('admission').textContent='交易计划已重置。'});
$('copyBtn').addEventListener('click',async()=>{if(!lastPlan)return;try{await navigator.clipboard.writeText(JSON.stringify(lastPlan,null,2));$('copyBtn').textContent='已复制';setTimeout(()=>$('copyBtn').textContent='复制交易计划 JSON',1500)}catch{showError(new Error('剪贴板权限不可用，请使用导出JSON'))}});
$('downloadBtn').addEventListener('click',()=>{if(!lastPlan)return;const blob=new Blob([JSON.stringify(lastPlan,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`PA-plan-${symbol()}-${Date.now()}.json`;a.click();URL.revokeObjectURL(a.href)});
$('marketType').addEventListener('change',()=>{ticker=null;structure=null;rules=null;setStatus(false,'市场已切换，请刷新行情')});
refresh().catch(showError);
let refreshBusy=false;setInterval(async()=>{if(document.visibilityState!=='visible'||refreshBusy)return;refreshBusy=true;try{await refresh()}catch(e){showError(e)}finally{refreshBusy=false}},15000);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
