import {statisticsTodayStart} from './modelo-reinicios.mjs?v=tintin-20261112-delivery-separate-1';
const yearFormatter=new Intl.DateTimeFormat('en',{timeZone:'America/Asuncion',year:'numeric'});
export const commerceYear=value=>yearFormatter.format(value);
export function commercePeriodStart(days,now=new Date()){
 return days===0?new Date(0):statisticsTodayStart(new Date(now.getTime()-(Math.max(1,days)-1)*86400000));
}
export function commercePeriodWindow({days=7,year=null,now=new Date()}={}){
 const start=year?statisticsTodayStart(new Date(Date.UTC(Number(year),0,1,12))).getTime():commercePeriodStart(days,now).getTime();
 const end=year?Math.min(statisticsTodayStart(new Date(Date.UTC(Number(year)+1,0,1,12))).getTime(),now.getTime()+1):now.getTime()+1;
 return {start,end};
}
export function commercePeriodContains(value,options={}){
 const time=value instanceof Date?value.getTime():Number(value);
 const {start,end}=commercePeriodWindow(options);
 return Number.isFinite(time)&&time>0&&time>=start&&time<end;
}
