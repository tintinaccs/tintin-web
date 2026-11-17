import {contextFromLocation,checkoutFailureReason} from './contexto-actividad.mjs?v=tintin-20261117-activity-1';
export function observeActivity({window:win,document:doc,onChange}) {
  let timer=0,signature='',checkoutStatus='',checkoutReason='',checkoutPhase='',lastStep=-1,currentSurface='';
  const context=()=>{const step=[...doc.querySelectorAll('.ck-panel')].findIndex(node=>node.classList.contains('active'));if(step!==lastStep){checkoutStatus='';checkoutReason='';checkoutPhase='';lastStep=step;}return contextFromLocation({pathname:win.location.pathname,search:win.location.search,
    step,
    section:doc.querySelector('[data-profile-panel]:not([hidden])')?.dataset.profilePanel,
    status:win.TintinCheckoutOrderCompleted ? 'confirmed' : checkoutStatus || (win.TintinCheckoutOrderInFlight ? 'confirming' : 'reviewing'),reason:checkoutReason,phase:checkoutPhase,surface:currentSurface});};
  const sample=()=>{const value=context();if(value.page==='checkout' && !win.TintinCheckoutOrderInFlight && doc.querySelector('.ck-panel.active .ck-error.show') && value.status!=='error'){checkoutStatus='error';value.status='error';onChange('validation_error',value);}const next=JSON.stringify(value);if(next!==signature){signature=next;onChange('view',value);}};
  const schedule=()=>{win.clearTimeout(timer);timer=win.setTimeout(sample,120);};
  const observer=new win.MutationObserver(schedule);
  observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-selected']});
  const record=(action,code)=>{const value=context();if(value.page==='checkout'){if(action==='checkout_confirm'||action==='order_confirmed'){checkoutReason='';checkoutPhase='';delete value.reason;delete value.phase;}const state={checkout_confirm:'confirming',checkout_error:'error',order_confirmed:'confirmed',payment_pending:'payment_pending'}[action];if(state){checkoutStatus=state;value.status=state;}if(action==='checkout_progress' && ['preparing','profile','guard','server'].includes(code)){checkoutStatus='confirming';checkoutPhase=code;value.status='confirming';value.phase=code;}if(action==='checkout_error'){checkoutReason=checkoutFailureReason(code);value.reason=checkoutReason;}}onChange(action,value);};
  const click=event=>{schedule();};
  const surface=event=>{currentSurface=event.detail?.surface||'';if(currentSurface==='cart')record('cart_open');else if(currentSurface)record('panel_open');schedule();};
  const search=event=>{if(event.key==='Enter' && event.target?.matches?.('#search-input,#cat-search'))record('search');};
  const payment=()=>record('order_confirmed');
  doc.addEventListener('click',click,true);doc.addEventListener('keydown',search,true);
  win.addEventListener('popstate',schedule);win.addEventListener('pageshow',schedule);
  win.addEventListener('tintin:surface-change',surface);
  win.addEventListener('tintin:paypal-payment-completed',payment);
  sample();
  return {context,record,stop(){observer.disconnect();win.clearTimeout(timer);doc.removeEventListener('click',click,true);win.removeEventListener('popstate',schedule);win.removeEventListener('pageshow',schedule);doc.removeEventListener('keydown',search,true);win.removeEventListener('tintin:surface-change',surface);win.removeEventListener('tintin:paypal-payment-completed',payment);}};
}
