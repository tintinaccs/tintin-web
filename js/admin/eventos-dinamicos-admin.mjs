// Adaptador declarativo para los callbacks del panel que antes se interpolaban
// en atributos on*. Los argumentos son datos JSON; nunca se evalúa JavaScript.
const actions=new Set(['setUsersPage','updateUserRole','restoreUser','blockUser','toggleOrderDetail','updateOrderStatus','updatePayStatus','resendOrderEmail','openOrderEdit','deleteOrder','toggleOrderTypeEnabled','setOrderTypeTemplate','previewOrderType','openTplEdit','previewTemplateById','duplicateTemplate','toggleArchiveTemplate','deleteTemplate','toggleClientSelected','removePromoRecipient','viewLogDetail','retryFailedLog','toggleShipCitySelect','prodEditar','prodToggleActive','prodEliminar','collVerProductos','collEditar','collEliminar','collCrearDesdeCategoria','collMoveProduct','collToggleActive','collRemoveFromCollection','setCsvRowCategory','updateOeItemQty','removeOeItem']);
const events=['click','change','input'];
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function adminEventAttributes(event,action,args=[]){
  if(!events.includes(event) || !actions.has(action) || !Array.isArray(args))throw Error('Evento administrativo no permitido.');
  return `data-admin-${event}="${action}" data-admin-${event}-args="${escape(JSON.stringify(args))}"`;
}
const installations=new WeakMap();
export function installAdminEvents(root=document){
  if(installations.has(root))return installations.get(root);
  const bound=new WeakMap();let active=true;
  const selector=events.map(event=>`[data-admin-${event}]`).join(',');
  function bind(element){
    if(element.nodeType!==1)return;
    const attached=bound.get(element) || new Map();bound.set(element,attached);
    for(const event of events){
      if(!element.hasAttribute(`data-admin-${event}`) || attached.has(event))continue;
      const listener=()=>{
        if(!active || !root.contains(element))return;
        const action=element.getAttribute(`data-admin-${event}`);
        if(!actions.has(action) || typeof window[action]!=='function')return;
        let args;
        try{
          args=JSON.parse(element.getAttribute(`data-admin-${event}-args`) || '[]');
          if(!Array.isArray(args) || args.length>8)return;
          args=args.map(value=>{
            if(value===null || ['string','number','boolean'].includes(typeof value))return value;
            if(!value || Object.keys(value).length!==1)throw Error('Argumento inválido.');
            if(value.control==='element')return element;
            if(value.control==='value')return element.value;
            if(value.control==='checked')return element.checked;
            throw Error('Argumento inválido.');
          });
        }catch{return;}
        window[action](...args);
      };
      attached.set(event,listener);element.addEventListener(event,listener);
    }
  }
  function scan(node){bind(node);node.querySelectorAll?.(selector).forEach(bind);}
  scan(root);
  const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(scan)));
  observer.observe(root,{childList:true,subtree:true});
  const stop=()=>{
    active=false;observer.disconnect();
    for(const element of [root,...root.querySelectorAll('*')])for(const [event,listener] of bound.get(element) || [])element.removeEventListener(event,listener);
    installations.delete(root);
  };
  installations.set(root,stop);return stop;
}
