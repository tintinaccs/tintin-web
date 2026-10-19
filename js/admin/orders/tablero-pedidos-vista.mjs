import { ORDER_STAGES, orderStage, orderStatusLabel, nextOrderStatus, orderNeedsAttention, shippingMethod } from '../../orders/ciclo-pedido.mjs?v=tintin-20261012-orders-board-1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => Number.isFinite(Number(value)) ? `${Math.round(Number(value)).toLocaleString('es-PY')} Gs` : 'No registrado';
const time = value => value?.toMillis?.() ?? (value?.seconds ? value.seconds*1000 : new Date(value || 0).getTime());
const date = value => time(value) ? new Date(time(value)).toLocaleString('es-PY',{dateStyle:'short',timeStyle:'short'}) : 'Fecha no registrada';
export function elapsedOrderTime(value, now = Date.now()) {
  const at=time(value); if (!at || !Number.isFinite(at)) return 'Fecha no registrada';
  const minutes=Math.max(0,Math.floor((now-at)/60000));
  return minutes < 1 ? 'Ahora' : minutes < 60 ? `Hace ${minutes} min` : minutes < 1440 ? `Hace ${Math.floor(minutes/60)} h` : `Hace ${Math.floor(minutes/1440)} días`;
}
export function deliveryLabel(order) {
  const method=shippingMethod(order);
  return method === 'retiro' ? 'Retiro coordinado' : method === 'encomienda' ? 'Encomienda' : order.shipping?.service === 'express' || order.shipping?.express === true ? 'Envío express' : 'Delivery propio';
}
export function orderCardHtml(order, model) {
  const payment=order.paymentStatus || order.payment?.status || 'pendiente';
  const items=Array.isArray(order.items) ? order.items : [];
  const next=nextOrderStatus(order);
  const id=esc(order.id), display=esc(order.orderNumber || order.shortId || order.id);
  return `<article class="tt-order-card${orderNeedsAttention(order) ? ' needs-attention' : ''}" data-order-card="${id}" data-order-stage="${orderStage(order)}" aria-label="Pedido ${display}">
    <div class="tt-order-card-top"><strong>#${display}</strong>${model.canBulk ? `<input type="checkbox" data-select-order="${id}" aria-label="Seleccionar pedido ${display}" ${model.selected.has(order.id) ? 'checked' : ''}>` : ''}</div>
    <time datetime="${time(order.createdAt) ? new Date(time(order.createdAt)).toISOString() : ''}">${esc(date(order.createdAt))}</time><span class="tt-order-elapsed">${esc(elapsedOrderTime(order.createdAt))}</span>
    <h3>${esc(order.userName || order.customer?.name || 'Cliente sin nombre')}</h3>
    <small>Origen: ${esc(order.localEntryId ? 'Venta local (manual)' : order.source || order.channel || (String(order.id).startsWith('manual_') ? 'Manual' : 'Sin origen registrado'))}</small>
    <p class="tt-order-items">${esc(items.slice(0,2).map(i=>`${i.qty ?? i.quantity ?? 1} × ${i.name || i.title || 'Producto'}`).join(' · ') || 'Detalle no registrado')}${items.length > 2 ? ` · +${items.length-2} productos` : ''}</p>
    <div class="tt-order-card-total"><strong>${money(order.total)}</strong><span>${esc(model.payLabels[payment] || payment)}</span></div>
    <div class="tt-order-card-meta"><span>${esc(deliveryLabel(order))}</span><span class="tt-order-stage-badge">${esc(orderStatusLabel(order))}</span></div>
    ${orderNeedsAttention(order) ? '<small>Requiere revisión</small>' : ''}
    <div class="tt-order-card-actions"><button type="button" class="tt-commerce-btn" data-action="drawer-order" data-id="${id}">Ver detalles</button>${next && model.canUpdate && !order.localEntryId ? `<button type="button" class="tt-commerce-btn primary" data-action="order-advance" data-id="${id}" ${model.busyIds.has(order.id) || model.offline ? 'disabled' : ''}>${esc(orderStatusLabel({...order,status:next}))}</button>` : ''}</div>
  </article>`;
}
function keepFocus(root) {
  const el=document.activeElement;
  if (!root.contains(el)) return ()=>{};
  const filter=el.dataset?.filter;
  const action=el.dataset?.action, id=el.dataset?.id;
  const start=el.selectionStart, end=el.selectionEnd;
  return ()=>{
    const next=filter ? root.querySelector(`[data-filter="${filter}"]`) : action ? [...root.querySelectorAll('[data-action]')].find(n=>n.dataset.action===action && n.dataset.id===id) : null;
    if (next && next !== document.activeElement) { next.focus({preventScroll:true}); if (typeof start==='number') next.setSelectionRange?.(start,end); }
  };
}
export function renderOrderBoard(root, model) {
  const restore=keepFocus(root);
  if (!root.querySelector('[data-orders-board]')) root.innerHTML=`
    <div class="tt-commerce-pagehead"><div class="tt-commerce-titlegroup"><h1 class="tt-commerce-title">Gestión de pedidos</h1><p class="tt-commerce-subtitle">Pago, preparación y entrega, con datos sincronizados.</p></div><div class="tt-commerce-actions">${model.isSuper ? '<button type="button" class="tt-commerce-btn" data-action="orders-manual-new">Nuevo pedido</button>' : ''}<button type="button" class="tt-commerce-btn" data-action="orders-export">Exportar</button><button type="button" class="tt-commerce-btn" data-action="orders-sound" aria-pressed="false">Sonido desactivado</button></div></div>
    <div class="tt-order-metrics" aria-label="Resumen de pedidos">${[...ORDER_STAGES,{key:'attention',label:'Requieren atención'}].map(stage=>`<div data-order-stage="${stage.key}"><strong data-stage-count="${stage.key}">—</strong><span>${esc(stage.label)}</span></div>`).join('')}</div>
    <div class="tt-order-status" role="status" data-orders-status></div><div class="tt-order-notice" role="status" data-order-notice hidden></div>
    <div class="tt-commerce-toolbar tt-order-toolbar"><label>Buscar pedido<input type="search" class="tt-commerce-input" data-filter="order-search" placeholder="Número, cliente, teléfono o producto"></label><label>Pago<select class="tt-commerce-select" data-filter="order-pay"><option value="">Todos los pagos</option>${Object.entries(model.payLabels).filter(([k])=>k!=='error').map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('')}</select></label><label>Entrega<select class="tt-commerce-select" data-filter="order-delivery"><option value="">Todas las entregas</option><option value="delivery">Delivery propio / express</option><option value="encomienda">Encomienda</option><option value="retiro">Retiro coordinado</option></select></label><label>Orden<select class="tt-commerce-select" data-filter="order-sort"><option value="date-desc">Más recientes</option><option value="date-asc">Más antiguos</option></select></label></div>
    <div class="tt-order-views">${[['all','Tablero'],['attention','Incidencias y cancelados'],['history','Históricos'],['buyers','Clientes que compraron'],...(model.isSuper ? [['deleted','Borrados']] : [])].map(([key,label])=>`<button type="button" class="tt-commerce-btn" data-tab-module="orders" data-tab="${key}" aria-pressed="false">${label}</button>`).join('')}</div>
    <div class="tt-commerce-bulkbar" data-order-bulk hidden><span data-order-selected-count></span>${model.canUpdate ? '<button type="button" class="tt-commerce-btn" data-action="orders-bulk-preparing">En preparación</button>' : ''}<button type="button" class="tt-commerce-btn" data-action="orders-export-selected">Exportar selección</button><button type="button" class="tt-commerce-btn" data-action="orders-clear-selection">Limpiar selección</button></div>
    <div class="tt-order-stage-tabs" role="tablist" aria-label="Etapas del pedido">${ORDER_STAGES.map((s,index)=>`<button type="button" role="tab" id="order-tab-${s.key}" data-action="order-stage" data-stage="${s.key}" aria-controls="order-lane-${s.key}" aria-selected="false"><span class="tt-order-step-index" aria-hidden="true">${index+1}</span><span class="tt-order-step-label">${esc(s.label)}</span> <span data-lane-tab-count="${s.key}">0</span></button>`).join('')}</div>
    <div class="tt-order-board" data-orders-board tabindex="0" aria-label="Tablero de pedidos">${[...ORDER_STAGES,{key:'attention',label:'Incidencias, cancelaciones y devoluciones'},{key:'history',label:'Pedidos históricos'}].map((s,index)=>`<section class="tt-order-lane" id="order-lane-${s.key}" data-order-lane="${s.key}" aria-label="${esc(s.label)}"><h2>${index < ORDER_STAGES.length ? `<span class="tt-order-step-index" aria-hidden="true">${index+1}</span>` : ''}<span class="tt-order-step-label">${esc(s.label)}</span> <span data-lane-count="${s.key}">0</span></h2><div class="tt-order-lane-cards" data-lane-cards></div><p class="tt-order-empty">Sin pedidos en esta etapa</p><button type="button" class="tt-commerce-btn" data-action="order-show-more" data-stage="${s.key}" hidden>Ver más pedidos</button></section>`).join('')}</div>`;
  let retry=root.querySelector('[data-orders-status-retry]');
  if(!retry){retry=document.createElement('button');retry.type='button';retry.className='tt-commerce-btn';retry.dataset.action='orders-retry';retry.dataset.ordersStatusRetry='';retry.textContent='Reintentar sincronización';root.querySelector('[data-orders-status]').after(retry);}
  retry.hidden=!model.error;
  const status=root.querySelector('[data-orders-status]');
  status.textContent=model.error ? `${model.error} Se conservan los últimos datos confirmados.` : model.offline ? 'Sin conexión. Las acciones están pausadas hasta recuperar la sincronización.' : !model.ready ? 'Sincronizando pedidos…' : `${model.allOrders.length} pedidos sincronizados. Los contadores corresponden al conjunto disponible para tu rol.`;
  status.setAttribute('role',model.error || model.offline ? 'alert' : 'status');
  model.offline=model.offline || !!model.error || !model.ready;
  const counts=Object.fromEntries(ORDER_STAGES.map(s=>[s.key,model.allOrders.filter(o=>orderStage(o)===s.key).length]));
  counts.attention=model.allOrders.filter(orderNeedsAttention).length;
  root.querySelectorAll('[data-stage-count]').forEach(e=>e.textContent=model.ready && !model.error ? String(counts[e.dataset.stageCount] || 0) : '—');
  root.querySelectorAll('[data-filter]').forEach(e=>{const value=({'order-search':model.search,'order-pay':model.pay,'order-delivery':model.delivery,'order-sort':model.sort})[e.dataset.filter];if(e.value!==value)e.value=value || '';});
  root.querySelectorAll('[data-tab-module="orders"]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.tab===model.tab)));
  const sound=root.querySelector('[data-action="orders-sound"]');sound.textContent=model.sound ? 'Sonido activado' : 'Sonido desactivado';sound.setAttribute('aria-pressed',String(model.sound));
  const bulk=root.querySelector('[data-order-bulk]');bulk.hidden=!model.canBulk || !model.selected.size;root.querySelector('[data-order-selected-count]').textContent=`${model.selected.size} seleccionados`;
  const isBoard=model.tab==='all';
  root.querySelector('.tt-order-stage-tabs').hidden=!isBoard;
  root.querySelector('[data-orders-board]').dataset.selectedStage=model.stage;
  root.querySelectorAll('[data-action="order-stage"]').forEach(e=>{e.setAttribute('aria-selected',String(e.dataset.stage===model.stage));e.tabIndex=e.dataset.stage===model.stage ? 0 : -1;});
  const cardMap=new Map([...root.querySelectorAll('[data-order-card]')].map(e=>[e.dataset.orderCard,e]));
  const shown=new Set();
  for (const lane of root.querySelectorAll('[data-order-lane]')) {
    const key=lane.dataset.orderLane;
    lane.hidden=isBoard ? ['attention','history'].includes(key) : key !== (model.tab==='history' ? 'history' : 'attention');
    const orders=model.orders.filter(o=>model.tab==='attention' ? key==='attention' && orderNeedsAttention(o) : orderStage(o)===key);
    lane.querySelector('[data-lane-count]').textContent=String(orders.length);
    const tabCount=root.querySelector(`[data-lane-tab-count="${key}"]`);if(tabCount)tabCount.textContent=String(orders.length);
    const visible=orders.slice(0,model.visible[key] || 30), host=lane.querySelector('[data-lane-cards]');
    let previous = null;
    for (const order of visible) {
      shown.add(order.id);
      const html=orderCardHtml(order,model), fingerprint=html;
      let card=cardMap.get(order.id);
      if (!card || card.dataset.fingerprint!==fingerprint) {
        const template=document.createElement('template');template.innerHTML=html;const next=template.content.firstElementChild;next.dataset.fingerprint=fingerprint;
        if(card)card.replaceWith(next);card=next;
      }
      const expected = previous ? previous.nextElementSibling : host.firstElementChild;
      if(expected !== card)host.insertBefore(card,expected);
      previous=card;
    }
    lane.querySelector('.tt-order-empty').hidden=orders.length>0 || !model.ready;
    lane.querySelector('[data-action="order-show-more"]').hidden=orders.length<=visible.length;
  }
  for(const [id,card] of cardMap)if(!shown.has(id))card.remove();
  restore();
}
