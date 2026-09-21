import { formatInTimeZone } from 'date-fns-tz';
export const pct=(log:number,digits=1):string=>`${log>=0?'+':'−'}${Math.abs(Math.expm1(log)*100).toFixed(digits)}%`;
export const share=(v:number):string=>`${(v*100).toFixed(1)}%`;
const priceFormatter=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export const price=(v:number):string=>priceFormatter.format(v);
export const money=(v:number|null):string=>v===null?'Unavailable':v>=1e6?`$${(v/1e6).toFixed(1)}M`:`$${(v/1000).toFixed(0)}k`;
export function countdown(ms:number):string {const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');}
export const time=(ts:number,zone='America/New_York',pattern='EEE HH:mm'):string=>formatInTimeZone(ts,zone,pattern);
export const bandWidth=(low:number,high:number):string=>`±${(Math.expm1(Math.log(high/low)/2)*100).toFixed(1)}%`;
export const age=(ms:number):string=>ms<60000?'less than 1m':ms<3600000?`${Math.floor(ms/60000)}m`:ms<86400000?`${Math.floor(ms/3600000)}h`:`${Math.floor(ms/86400000)}d`;
export const sectorName=(s:string):string=>({semis:'Semiconductors',megacap_tech:'Megacap technology',crypto_beta:'Crypto exposure',consumer_growth:'Consumer growth',financials:'Financials',software:'Software'}[s]??s);
