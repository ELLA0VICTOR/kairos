const requests=new Map<string,{start:number;count:number}>();
let day='',reserved=0;
export function rateAllowed(ip:string,now=Date.now()):boolean {
  for(const [key,value] of requests)if(now-value.start>=3600000)requests.delete(key);
  const value=requests.get(ip)??{start:now,count:0};value.count++;requests.set(ip,value);return value.count<=20;
}
/** Reserve estimated input plus maximum output; this is a per-process soft cap. */
export function reserveLanguageBudget(tokens:number,now=Date.now(),limit=Number(process.env.QWEN_DAILY_TOKEN_BUDGET??30000)):boolean {
  const today=new Date(now).toISOString().slice(0,10);if(today!==day){day=today;reserved=0;}
  if(!Number.isFinite(tokens)||tokens<0||!Number.isFinite(limit)||limit<0||reserved+tokens>limit)return false;reserved+=tokens;return true;
}
/** Replace an estimate with reported usage, including any underestimated tokens. */
export function reconcileLanguageBudget(reservation:number,actual:number,reservedAt:number):void {
  if(new Date(reservedAt).toISOString().slice(0,10)!==day)return;
  if(Number.isFinite(reservation)&&reservation>=0&&Number.isFinite(actual)&&actual>=0)reserved=Math.max(0,reserved-reservation+actual);
}
