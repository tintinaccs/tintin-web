import { auth, db, authPersistenceReady, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { collection, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { calculateOrderStats } from '../../core/store/estadisticas-pedidos.js?v=tintin-20260716-cloudinary-fix-3';
import { reconcileAccountOrders } from './estado-canonico-perfil.mjs?v=tintin-20260908-profile-canonical-1';

const PAGE = /(?:^|\/)perfil(?:\.html)?\/?$/i;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => `Gs. ${Math.round(Number(value) || 0).toLocaleString('es-PY')}`;
const clean = value => String(value ?? '').trim();
const statusLabels = { pendiente:'Pendiente', confirmado:'Confirmado', preparando:'Preparando', listo_retiro:'Listo para retirar', en_camino:'En camino', enviado:'Enviado', entregado:'Entregado', cancelado:'Cancelado', rechazado:'Rechazado', reembolsado:'Reembolsado' };
const terminal = new Set(['cancelado','rechazado','reembolsado']);
const stages = ['pendiente','confirmado','preparando','enviado','entregado'];

function dateOf(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value < 1e11 ? value * 1000 : value);
  if (value?.seconds != null) return new Date(value.seconds * 1000);
  return value ? new Date(value) : null;
}
function timestamp(order) {
  const date = dateOf(order.createdAt || order.updatedAt);
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
}
function statusOf(order) {
  const value = clean(order.status || 'pendiente').toLowerCase();
  return statusLabels[value] ? value : 'pendiente';
}
function statusBadge(order) {
  const status = statusOf(order);
  return `<span class="tt-profile-status tt-profile-status--${status}" data-order-status="${status}">${escapeHtml(statusLabels[status])}</span>`;
}
function paymentText(order) {
  const payment = order.payment;
  return clean(order.paymentMethod || (typeof payment === 'object' ? payment?.method : payment) || 'A confirmar');
}
function deliveryText(order) {
  return clean(order.shippingMethod || order.deliveryMethod || order.delivery?.method || 'A coordinar');
}
function addressText(order) {
  return clean(order.address || order.deliveryAddress || order.delivery?.address || order.city || 'Sin dirección registrada');
}
function timeline(order) {
  const status = statusOf(order);
  if (terminal.has(status)) return `<p class="tt-profile-status tt-profile-status--cancelado">${escapeHtml(statusLabels[status])}</p>`;
  const normalized = status === 'listo_retiro' || status === 'en_camino' ? 'enviado' : status;
  const index = stages.indexOf(normalized);
  return `<div class="tt-profile-timeline" aria-label="Seguimiento del pedido">${stages.map((stage,i) => `<span class="tt-profile-step ${i <= index ? 'is-done' : ''}">${statusLabels[stage]}</span>`).join('')}</div>`;
}
function orderMarkup(order) {
  const id = clean(order.id);
  const anchor = id.replace(/[^A-Za-z0-9_-]/g,'').slice(0,200);
  const date = dateOf(order.createdAt || order.updatedAt);
  const dateText = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Fecha no disponible';
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = items.map(item => {
    const qty = Math.max(1,Number(item.qty || item.quantity) || 1);
    return `<div class="tt-profile-order-line"><span>${qty}x ${escapeHtml(item.name || 'Producto')}</span><strong>${money((Number(item.price)||0)*qty)}</strong></div>`;
  }).join('');
  const summary = items.slice(0,3).map(item => `${Math.max(1,Number(item.qty || item.quantity)||1)}x ${escapeHtml(item.name || 'Producto')}`).join(', ');
  const extra = items.length > 3 ? ` +${items.length-3} más` : '';
  return `<article class="perfil-order-row" id="pedido-${anchor}" data-order-id="${escapeHtml(id)}"><div class="tt-profile-order-head"><span class="tt-profile-order-meta">#${escapeHtml(id.slice(-6).toUpperCase())} · ${dateText}</span>${statusBadge(order)}</div><div class="tt-profile-order-items">${summary || 'Sin detalle de productos'}${extra}</div><div class="tt-profile-order-total">Total: ${money(order.total)}</div><details class="tt-profile-order-details"><summary>Ver seguimiento y detalle</summary>${timeline(order)}<div class="tt-profile-order-grid"><div><strong>Pago</strong>${escapeHtml(paymentText(order))}</div><div><strong>Entrega</strong>${escapeHtml(deliveryText(order))}</div><div><strong>Dirección</strong>${escapeHtml(addressText(order))}</div><div><strong>Número de pedido</strong>${escapeHtml(id)}</div><div class="tt-profile-order-lines"><strong>Productos</strong>${lines || 'Sin detalle de productos'}<div class="tt-profile-order-line"><span>Total</span><strong>${money(order.total)}</strong></div></div></div></details></article>`;
}

export function createProfileOrdersController({ subscribe, render, onStatus, onStats }) {
  let generation = 0;
  let stops = [];
  let identity = null;
  let slices = [];
  let ready = [];
  let current = [];
  let error = null;
  const stop = () => { generation++; stops.forEach(fn => fn()); stops=[]; identity=null; slices=[]; ready=[]; current=[]; error=null; };
  function start(user) {
    stop();
    if (!user?.uid) { render([],{empty:true,reset:true}); onStats(null); onStatus('signed-out'); return; }
    identity = {uid:user.uid,email:clean(user.email).toLowerCase()};
    const token = generation;
    const filters = [['userId',user.uid]];
    if (user.email) filters.push(['userEmail',user.email]);
    if (identity.email && identity.email !== user.email) filters.push(['userEmail',identity.email]);
    slices = filters.map(() => []);
    ready = filters.map(() => false);
    onStatus('loading');
    const callbacks = filters.map(([field,value],index) => ({
      next: rows => {
        if (token !== generation || !identity || error) return;
        slices[index] = rows;
        ready[index] = true;
        if (!ready.every(Boolean)) return;
        current = reconcileAccountOrders(slices).sort((a,b) => timestamp(b)-timestamp(a));
        onStats(calculateOrderStats(current));
        render(current,{empty:current.length===0});
        onStatus('ready');
      },
      fail: failure => {
        if (token !== generation) return;
        error = failure;
        stops.forEach(fn => fn()); stops=[];
        onStatus('error',failure);
        render(current,{error:failure,stale:current.length>0});
      }, field, value
    }));
    for (const callback of callbacks) {
      const unsubscribe = subscribe(callback.field,callback.value,callback.next,callback.fail);
      stops.push(unsubscribe);
    }
  }
  return { start, stop, get identity(){return identity;}, get orders(){return current.slice();} };
}

export function startProfileOrders() {
  if (!PAGE.test(location.pathname || '') || window.TintinProfileOrdersBooted) return;
  window.TintinProfileOrdersBooted = true;
  const list = document.getElementById('perfil-orders-list');
  if (!list) return;
  const card = document.getElementById('perfil-orders-card');
  const count = document.getElementById('perfil-purchase-count');
  const total = document.getElementById('perfil-total-spent');
  const status = document.createElement('div');
  status.id = 'tt-profile-orders-status';
  status.className = 'tt-profile-order-meta';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  list.before(status);
  let visible = 5;
  let lastOrders = [];
  let lastOptions = {};
  let currentUser = null;
  let authStop = null;
  let stopped = false;
  const render = (orders,options={}) => {
    lastOrders = orders;
    lastOptions = options;
    if (card) card.style.display = 'block';
    if (options.reset) { list.replaceChildren(); list.setAttribute('aria-busy','true'); return; }
    if (options.error && !options.stale) { list.innerHTML = '<div class="tt-profile-state" role="alert">No pudimos cargar tus pedidos. <button type="button" class="perfil-btn perfil-btn-outline" data-profile-orders-retry>Reintentar</button></div>'; list.setAttribute('aria-busy','false'); return; }
    if (options.empty) { list.innerHTML = '<div class="tt-profile-state">Todavía no tenés pedidos.<br><a href="/catalogo" class="perfil-btn perfil-btn-outline">Ver productos →</a></div>'; list.setAttribute('aria-busy','false'); return; }
    const openIds = new Set([...list.querySelectorAll('article[data-order-id] details[open]')].map(node=>node.closest('article').dataset.orderId));
    list.innerHTML = orders.slice(0,visible).map(orderMarkup).join('') + (orders.length > visible ? '<button type="button" class="perfil-btn perfil-btn-outline" data-profile-orders-more>Cargar más pedidos</button>' : '');
    for (const article of list.querySelectorAll('article[data-order-id]')) if (openIds.has(article.dataset.orderId)) article.querySelector('details')?.setAttribute('open','');
    list.setAttribute('aria-busy','false');
    const requested = String(location.hash||'').match(/^#pedido-([A-Za-z0-9_-]+)$/)?.[1];
    if (requested) { const target=document.getElementById(`pedido-${requested}`); if (target){target.querySelector('details')?.setAttribute('open',''); if(!target.dataset.ttFocused){target.dataset.ttFocused='1';target.scrollIntoView({block:'center'});}} }
  };
  const controller = createProfileOrdersController({
    subscribe: (field,value,next,fail) => onSnapshot(query(collection(db,'orders'),where(field,'==',value)),snapshot=>next(snapshot.docs.map(doc=>({id:doc.id,...doc.data()}))),fail),
    render,
    onStatus: (state,error) => { status.dataset.state=state; status.textContent=state==='ready'?'Pedidos sincronizados':state==='loading'?'Sincronizando pedidos…':state==='signed-out'?'':state==='error'?(navigator.onLine===false?'Sin conexión. Tus pedidos no se pudieron actualizar.':'No pudimos sincronizar tus pedidos. Se conservan los últimos datos confirmados.'):''; if(error) console.warn('[profile-orders]',error); },
    onStats: stats => { if(count)count.textContent=stats?String(stats.totalOrders):'—'; if(total)total.textContent=stats?money(stats.totalSpent):'—'; if(stats)window.dispatchEvent(new CustomEvent('tintin:profile-orders',{detail:{count:stats.totalOrders,total:stats.totalSpent}})); }
  });
  const retry = async () => { if (!currentUser || stopped) return; status.textContent='Sincronizando pedidos…'; await appCheckReady; if (!stopped && auth.currentUser?.uid===currentUser.uid) controller.start(currentUser); };
  list.addEventListener('click',event=>{ if(event.target.closest('[data-profile-orders-more]')){visible+=10;render(lastOrders,lastOptions);} if(event.target.closest('[data-profile-orders-retry]'))void retry(); });
  const onOnline = () => void retry();
  const onVisible = () => { if(!document.hidden && status.dataset.state==='error')void retry(); };
  window.addEventListener('online',onOnline);
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('pagehide',()=>{stopped=true;controller.stop();authStop?.();window.removeEventListener('online',onOnline);document.removeEventListener('visibilitychange',onVisible);},{once:true});
  Promise.resolve(authPersistenceReady).then(()=>auth.authStateReady?.()).then(()=>{if(stopped)return;authStop=onAuthStateChanged(auth,user=>{currentUser=user;visible=5;void (async()=>{if(user)await appCheckReady;if(!stopped && auth.currentUser?.uid===user?.uid)controller.start(user);})();});}).catch(error=>{status.textContent='No pudimos restaurar el historial de pedidos.';console.warn('[profile-orders]',error);});
  window.TintinProfileOrders={refresh:retry,stop:()=>controller.stop()};
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',startProfileOrders,{once:true});
  else startProfileOrders();
}
