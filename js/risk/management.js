function roundDown(value,step){if(!step||step<=0)return value;const p=Math.max(0,Math.ceil(-Math.log10(step))+4);return +(Math.floor((value+1e-12)/step)*step).toFixed(p);}

/** A conditional trade-management playbook. It never authorizes an otherwise rejected entry. */
export function buildManagementPlan({side,entry,stop,targets,position,rules,admissionStatus}){
  const executable=admissionStatus!=='REJECTED'&&position?.admissible===true&&position.qty>0;
  const targetsList=targets?.finalTargets||[];
  const fractions=[0.40,0.35,0.25];
  const names=['TP1','TP2','TP3'];
  let allocated=[null,null,null];
  if(position?.qty>0){
    const step=rules?.qtyStep||0;
    const q1=roundDown(position.qty*fractions[0],step);
    const q2=roundDown(position.qty*fractions[1],step);
    allocated=[q1,q2,Math.max(0,+(position.qty-q1-q2).toFixed(12))];
  }
  const exits=names.map((name,i)=>{
    const target=targetsList[i]||null;
    return {
      name,price:target?.price??null,rr:target?.rr??null,
      allocationPct:fractions[i]*100,quantity:executable?allocated[i]:null,
      blockedByStructure:target?.blockedByStructure??false,
      action:!target?'目标未生成':target.blockedByStructure?'前方结构可能阻挡；到达前重新评估，不机械持有':'触及目标后按计划分批减仓'
    };
  });
  const breakEvenBufferPct=0.001;
  const breakEvenStop=side==='LONG'?entry*(1+breakEvenBufferPct):entry*(1-breakEvenBufferPct);
  const trailingRule=side==='LONG'
    ?'TP2后，仅在新确认的更高低点形成后，将止损上移至该摆动低点下方并留ATR缓冲；不得下移止损'
    :'TP2后，仅在新确认的更低高点形成后，将止损下移至该摆动高点上方并留ATR缓冲；不得上移止损';
  const reversalEvent=side==='LONG'?'BEARISH_CHOCH 或 BEARISH_BOS':'BULLISH_CHOCH 或 BULLISH_BOS';
  return {
    status:!executable?'CONDITIONAL_ONLY':admissionStatus==='CAUTION'?'READY_WITH_CAUTION':'READY',
    executionAllowed:executable,
    explanation:!executable?'当前准入未通过或仓位不可执行。以下仅为条件式管理模板，不代表现在可以开仓，也不生成可下单数量':admissionStatus==='CAUTION'?'存在警告项。先逐项人工核实，再按下列分批与保护规则管理；工具不会执行订单':'准入检查通过，可参考下列分批与保护规则管理；仍需人工确认盘口、标记价格和订单规则',
    initialProtection:{stop,rule:'入场后立即设置保护止损；不得因浮亏而扩大初始风险'},
    scaleOut:exits,
    protectionAfterTP1:{trigger:'TP1成交并确认剩余仓位仍符合原交易逻辑',action:'将剩余仓位止损移至入场价附近并覆盖预计往返手续费/滑点',illustrativeStop:breakEvenStop,bufferPct:breakEvenBufferPct*100},
    protectionAfterTP2:{trigger:'TP2成交',action:trailingRule},
    earlyExit:{trigger:`已收盘K线出现 ${reversalEvent}，且价格行为确认原方向结构被破坏`,action:'停止新增仓位；评估提前平掉剩余仓位，不等待固定TP3'},
    invalidation:{trigger:'入场前价格已越过计划止损，或结构锚点被收盘价破坏',action:'取消原计划，重新分析；不得沿用旧止损和仓位'},
    operatingRules:['每次只按已成交仓位计算剩余数量；部分止盈后重新核对数量步长','止损只允许向盈利方向移动，不得扩大初始风险','若TP目标被结构阻挡，触及阻挡区前重新评估，不保证目标一定到达','若行情跳空、滑点异常或标记价格偏离，实际亏损可能超过估算值']
  };
}
