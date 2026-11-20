export function roundDown(value,step){
  if(!step||step<=0)return value;
  const p=Math.max(0,Math.ceil(-Math.log10(step))+4);
  return +(Math.floor((value+1e-12)/step)*step).toFixed(p);
}

function directionalStopValid(side,entry,stop){
  return Number.isFinite(stop)&&stop>0&&(side==='LONG'?stop<entry:stop>entry);
}

export function deriveStops({side,entry,structure,buffer=0.2,mode='structure',manualStop=null}){
  const long=side==='LONG';
  let stop=null,reason='',anchor=null,valid=true;
  if(mode==='manual'){
    stop=Number(manualStop);
    reason='用户手动止损；仍需人工确认结构有效性';
  }else if(mode==='atr'){
    if(!(structure?.atr>0))return {valid:false,mode,stop:null,reason:'ATR数据不足，无法生成ATR止损',distance:null,distancePct:null};
    stop=long?entry-structure.atr*1.5:entry+structure.atr*1.5;
    reason='入场价 ± 1.5 × ATR(14)';
  }else{
    const candidates=long?structure?.validLongStops:structure?.validShortStops;
    anchor=candidates?.find(p=>long?p.price<entry:p.price>entry)||null;
    if(!anchor||!(structure?.atr>0)){
      return {valid:false,mode,stop:null,anchor:null,reason:long
        ?'没有找到入场价下方且尚未被收盘价破坏的有效摆动低点'
        :'没有找到入场价上方且尚未被收盘价突破的有效摆动高点',distance:null,distancePct:null};
    }
    stop=long?anchor.price-structure.atr*buffer:anchor.price+structure.atr*buffer;
    reason=`有效摆动${long?'低点':'高点'} ${anchor.price}（未被后续收盘价破坏），${long?'下方':'上方'}增加 ${buffer}×ATR 缓冲`;
  }
  if(!directionalStopValid(side,entry,stop))valid=false;
  if(!valid)return {valid:false,mode,stop:null,anchor,reason:'止损方向错误：做多止损必须低于入场价，做空止损必须高于入场价',distance:null,distancePct:null};
  const distance=Math.abs(entry-stop);
  const atrRatio=structure?.atr>0?distance/structure.atr:null;
  const warnings=[];
  if(atrRatio!==null&&atrRatio<0.1)warnings.push('止损距离小于0.1 ATR，可能过窄，需检查结构与噪声风险');
  if(atrRatio!==null&&atrRatio>4)warnings.push('止损距离超过4 ATR，仓位可能过小或交易机会不经济');
  return {valid:true,mode,stop,anchor,reason,distance,distancePct:distance/entry,atrRatio,warnings};
}

function makeRTarget(side,entry,risk,r){
  return {name:`${r}R`,price:side==='LONG'?entry+r*risk:entry-r*risk,rr:r,source:'R_MULTIPLE'};
}

export function targets({side,entry,stop,structure,manualTp1=null,manualTp2=null}){
  if(!directionalStopValid(side,entry,stop))return {method:'STRUCTURE_FIRST_R_FALLBACK',rrTargets:[],structureTargets:[],finalTargets:[],warnings:['止损无效，无法计算止盈']};
  const risk=Math.abs(entry-stop);
  const rrTargets=[1.5,2.5,3.5].map(r=>makeRTarget(side,entry,risk,r));
  const warnings=[];
  const long=side==='LONG';

  // Use only confirmed, still-valid opposing pivots as structural profit targets.
  // Broken pivots are deliberately excluded: they have already been taken by price.
  const pivotList=long?(structure?.pivots?.highs||[]):(structure?.pivots?.lows||[]);
  const candidates=pivotList.filter(p=>p.valid===true&&(long?p.price>entry:p.price<entry));
  const unique=[...new Map(candidates.map(p=>[`${p.index}:${p.price}`,p])).values()];
  unique.sort((a,b)=>long?a.price-b.price:b.price-a.price);
  const structureTargets=unique.map((p,i)=>({name:`结构目标${i+1}`,price:p.price,rr:Math.abs(p.price-entry)/risk,source:'STRUCTURE',referenceIndex:p.index,referenceTime:p.time}));

  // Use the nearest confirmed opposing pivot before each R-multiple objective.
  // This places exits at real structural barriers instead of blindly targeting through them.
  const finalTargets=[];
  for(let i=0;i<rrTargets.length;i++){
    const rTarget=rrTargets[i];
    const previous=finalTargets.at(-1)?.price;
    const beforeTarget=structureTargets.filter(t=>long
      ?t.price>entry&&t.price<=rTarget.price&&(previous===undefined||t.price>previous)
      :t.price<entry&&t.price>=rTarget.price&&(previous===undefined||t.price<previous));
    const chosen=beforeTarget.length
      ?beforeTarget.sort((a,b)=>long?b.price-a.price:a.price-b.price)[0]
      :null;
    finalTargets.push(chosen
      ?{...chosen,name:`TP${i+1}`,source:'STRUCTURE',blockedByStructure:false,rr:Math.abs(chosen.price-entry)/risk,referenceIndex:chosen.referenceIndex}
      :{...rTarget,name:`TP${i+1}`,blockedByStructure:false,nearestStructureTarget:null});
  }
  // Manual targets, when supplied, override the corresponding calculated target only
  // when they preserve direction and monotonic target ordering.
  for(const [i,manual] of [[0,manualTp1],[1,manualTp2]]){
    if(!(manual>0))continue;
    const directionOK=long?manual>entry:manual<entry;
    const previousOK=i===0||(long?manual>finalTargets[i-1].price:manual<finalTargets[i-1].price);
    const nextOK=i>=finalTargets.length-1||(long?manual<finalTargets[i+1].price:manual>finalTargets[i+1].price);
    if(directionOK&&previousOK&&nextOK)finalTargets[i]={...finalTargets[i],price:manual,rr:Math.abs(manual-entry)/risk,source:'MANUAL'};
    else warnings.push(`手动TP${i+1}方向错误或破坏止盈顺序，已保留自动计算目标`);
  }
  if(!structureTargets.length)warnings.push('没有找到入场方向前方尚未被突破的有效结构目标，TP使用1.5R/2.5R/3.5R公式补位');
  if(finalTargets.length<3)warnings.push(`有效目标仅有 ${finalTargets.length} 个；请勿把缺失目标视为可执行止盈档位`);
  if(finalTargets.length&&Math.max(...finalTargets.map(t=>t.rr))<1.5)warnings.push('所有可用目标均不足1.5R，风险收益空间不足');
  if(finalTargets.some(t=>!Number.isFinite(t.rr)||t.rr<=0))warnings.push('存在方向错误或无效的止盈价格');
  return {method:'STRUCTURE_FIRST_R_FALLBACK',rrTargets,structureTargets,finalTargets,warnings};
}

/** Risk size is capped by both loss budget and available collateral; fees/funding/slippage are explicit. */
export function calculatePosition({equity,riskPct,entry,stop,leverage=1,feeRate=0,side='LONG',rules=null,market='futures',marginUtilization=0.8,slippagePct=0,fundingPct=0}){
  for(const [k,v] of Object.entries({equity,riskPct,entry,stop,leverage,feeRate,marginUtilization,slippagePct,fundingPct}))
    if(!Number.isFinite(+v))throw new Error(`${k} 不是有效数字`);
  if(equity<=0||riskPct<=0||entry<=0||stop<=0||leverage<=0)throw new Error('账户权益、风险比例、价格和杠杆必须大于0');
  if(!directionalStopValid(side,entry,stop))throw new Error('止损方向错误');
  if(marginUtilization<=0||marginUtilization>1||feeRate<0||slippagePct<0||fundingPct<0)throw new Error('保证金利用率、手续费、滑点和资金费率参数无效');

  const distance=Math.abs(entry-stop),distancePct=distance/entry;
  const riskBudget=equity*riskPct/100;
  const roundTripFeesPct=2*feeRate;
  const totalCostPct=distancePct+roundTripFeesPct+slippagePct+fundingPct;
  const riskNotional=riskBudget/totalCostPct;
  const capitalBudget=equity*marginUtilization;
  const collateralPerNotional=(1/leverage)+roundTripFeesPct+fundingPct;
  const marginNotional=capitalBudget/collateralPerNotional;
  const notionalCap=Math.min(riskNotional,marginNotional);
  const qtyRaw=notionalCap/entry;
  const qty=roundDown(qtyRaw,rules?.qtyStep||0);
  const actualNotional=qty*entry;
  const margin=actualNotional/leverage;
  const grossStopLoss=qty*distance;
  const estimatedOpenFee=actualNotional*feeRate;
  const estimatedCloseFee=actualNotional*feeRate;
  const estimatedFees=estimatedOpenFee+estimatedCloseFee;
  const estimatedSlippage=actualNotional*slippagePct;
  const estimatedFunding=actualNotional*fundingPct;
  const totalStopCost=grossStopLoss+estimatedFees+estimatedSlippage+estimatedFunding;
  const reservedCapital=margin+estimatedOpenFee+estimatedFunding;
  const minNotional=rules?.minNotional||0;
  const minQty=rules?.minQty||0;
  const step=rules?.qtyStep||0;
  const rawMinimumQty=Math.max(minQty,minNotional>0?minNotional/entry:0);
  const minimumTradableQty=rawMinimumQty>0?(step>0?Math.ceil((rawMinimumQty-1e-12)/step)*step:rawMinimumQty):null;
  const minimumTradableNotional=minimumTradableQty===null?null:minimumTradableQty*entry;
  const minimumGrossStopLoss=minimumTradableQty===null?null:minimumTradableQty*distance;
  const minimumFees=minimumTradableNotional===null?null:minimumTradableNotional*roundTripFeesPct;
  const minimumSlippage=minimumTradableNotional===null?null:minimumTradableNotional*slippagePct;
  const minimumFunding=minimumTradableNotional===null?null:minimumTradableNotional*fundingPct;
  const minimumStopCost=minimumGrossStopLoss===null?null:minimumGrossStopLoss+minimumFees+minimumSlippage+minimumFunding;
  const minimumMargin=minimumTradableNotional===null?null:(minimumTradableNotional/leverage);
  const minimumReservedCapital=minimumTradableNotional===null?null:minimumMargin+minimumTradableNotional*feeRate+minimumFunding;
  const equityForRisk=minimumStopCost===null?null:minimumStopCost/(riskPct/100);
  const equityForMargin=minimumReservedCapital===null?null:minimumReservedCapital/marginUtilization;
  const minimumRequiredEquity=equityForRisk===null?null:Math.max(equityForRisk,equityForMargin||0);
  const minimumOrderFitsRisk=minimumStopCost!==null&&minimumStopCost<=riskBudget*1.005;
  const minimumOrderFitsMargin=minimumReservedCapital!==null&&minimumReservedCapital<=capitalBudget+1e-9;
  const minimumOrderFeasible=minimumOrderFitsRisk&&minimumOrderFitsMargin&&(!rules||rules.status==='TRADING');
  const checks=[];
  if(rules&&rules.status!=='TRADING')checks.push(`交易状态为 ${rules.status}，不是TRADING`);
  if(rules&&qty<rules.minQty)checks.push(`数量 ${qty} 低于最小数量 ${rules.minQty}`);
  if(minNotional&&actualNotional<minNotional)checks.push(`名义价值 ${actualNotional.toFixed(4)} 低于交易所最小值 ${minNotional}`);
  if(totalStopCost>riskBudget*1.005)checks.push('数量取整后含手续费、滑点和资金费率的止损成本超过风险预算');
  if(reservedCapital>capitalBudget+1e-9)checks.push(`保证金及预留成本 ${reservedCapital.toFixed(4)} 超过可用保证金预算 ${capitalBudget.toFixed(4)}`);
  if(qty<=0)checks.push('按交易所数量步长取整后仓位为0');
  const feasibilityReasons=[];
  if(minimumTradableQty!==null&&!minimumOrderFitsRisk)feasibilityReasons.push(`交易所最小可交易数量 ${minimumTradableQty} 的预计止损成本 ${minimumStopCost.toFixed(4)} USDT，超过风险预算 ${riskBudget.toFixed(4)} USDT`);
  if(minimumTradableQty!==null&&!minimumOrderFitsMargin)feasibilityReasons.push(`最小可交易数量预计占用保证金及预留成本 ${minimumReservedCapital.toFixed(4)} USDT，超过可用预算 ${capitalBudget.toFixed(4)} USDT`);
  if(minimumRequiredEquity!==null&&(!minimumOrderFitsRisk||!minimumOrderFitsMargin))feasibilityReasons.push(`在当前止损、费用、风险比例和保证金利用率下，满足最小交易单位所需权益约 ${minimumRequiredEquity.toFixed(2)} USDT（仅为估算，不代表建议加资）`);
  return {
    marginType:'USDT-M',marginAsset:'USDT',settlementAsset:'USDT',
    riskBudget,riskNotional,marginNotional,notional:actualNotional,qty,qtyRaw,margin,
    capitalBudget,reservedCapital,grossStopLoss,estimatedOpenFee,estimatedCloseFee,estimatedFees,
    estimatedSlippage,estimatedFunding,totalStopCost,distance,distancePct,leverage,
    effectiveLossPct:totalCostPct,marginUtilization,checks,admissible:checks.length===0,
    minimumOrder:{qty:minimumTradableQty,notional:minimumTradableNotional,stopCost:minimumStopCost,requiredEquity:minimumRequiredEquity,margin:minimumMargin,reservedCapital:minimumReservedCapital,fitsRisk:minimumOrderFitsRisk,fitsMargin:minimumOrderFitsMargin,feasible:minimumOrderFeasible,reasons:feasibilityReasons}
  };
}

export function evaluateAdmission({side,structure,stop,targets,position}){
  const reasons=[],warnings=[];
  const oppositeTrend=side==='LONG'?'BEARISH':'BULLISH';
  const oppositeEvent=side==='LONG'?['BEARISH_BOS','BEARISH_CHOCH']:['BULLISH_BOS','BULLISH_CHOCH'];
  const alignedEvent=side==='LONG'?['BULLISH_BOS','BULLISH_CHOCH']:['BEARISH_BOS','BEARISH_CHOCH'];
  const directionAlignment=structure?.trend===oppositeTrend?'CONFLICT':structure?.trend=== (side==='LONG'?'BULLISH':'BEARISH')?'ALIGNED':'NEUTRAL';
  if(!structure)warnings.push('尚未完成价格结构分析；当前无法验证趋势与结构目标');
  if(!stop?.valid)reasons.push(stop?.reason||'缺少有效止损');
  if(directionAlignment==='CONFLICT')warnings.push(`计划方向与${oppositeTrend}趋势冲突`);
  if(oppositeEvent.includes(structure?.event))reasons.push(`最新结构事件 ${structure.event} 与计划方向相反`);
  if(structure?.event==='NONE'&&!alignedEvent.includes(structure?.event))warnings.push('没有发现与计划方向一致的新结构突破');
  if(stop?.warnings?.length)warnings.push(...stop.warnings);
  if(targets?.warnings?.length)warnings.push(...targets.warnings);
  if(position?.checks?.length)reasons.push(...position.checks);
  const structureSpaceInsufficient=targets?.warnings?.some(x=>x.includes('不足1.5R'));
  const rewardRiskValid=!!targets?.finalTargets?.length&&!structureSpaceInsufficient&&targets.finalTargets.some(t=>t.rr>=1.5)&&targets.finalTargets.every(t=>t.rr>0);
  if(targets?.finalTargets?.length&&!rewardRiskValid)reasons.push('结构目标空间不足，无法提供至少1.5R的有效目标');
  if(!targets?.finalTargets?.length)reasons.push('没有有效止盈目标');
  if(!position)reasons.push('止损或输入条件不合格，未生成可执行仓位');
  const status=reasons.length?'REJECTED':warnings.length?'CAUTION':'APPROVED';
  const marginSufficient=!!position&&(position.qty>0?position.reservedCapital<=position.capitalBudget+1e-9:position.minimumOrder?.fitsMargin===true);
  if(position?.qty<=0&&position?.minimumOrder?.reasons?.length)warnings.push(...position.minimumOrder.reasons);
  return {status,directionAlignment,structureValid:!!structure,stopValid:!!stop?.valid,marginSufficient,rewardRiskValid,reasons,warnings};
}
