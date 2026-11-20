export function roundToTick(value,tick){
  if(!tick||tick<=0)return value;
  const p=Math.max(0,Math.ceil(-Math.log10(tick))+4);
  return +(Math.round(value/tick)*tick).toFixed(p);
}
