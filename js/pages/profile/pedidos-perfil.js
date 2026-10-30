import { readAccountOrdersIndexPage } from './indice-pedidos-perfil.js?v=tintin-20261030-home-history-5';
import { ordersForView } from '../../orders/pedidos-prueba.mjs?v=tintin-20261020-orders-clean-2';
import { db, appCheckReady } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { AUTH_STATES, getSessionUser, subscribeSession } from '../../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { calculateOrderStats } from '../../core/store/estadisticas-pedidos.js?v=tintin-20261020-orders-clean-2';
import { ORDER_LIFECYCLE_LABELS, orderStatusLabel, orderTimeline, customerOrderMessage } from '../../orders/ciclo-pedido.mjs?v=tintin-20261012-orders-board-1';

const PAGE = /(?:^|\/)perfil(?:\.html)?\/?$/i;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => `Gs. ${Math.round(Number(value) || 0).toLocaleString('es-PY')}`;
const clean = value => String(value ?? '').trim();
const statusLabels = { ...ORDER_LIFECYCLE_LABELS, reembolsado:'Reembolsado' };
const terminal = new Set(['cancelado','rechazado','reembolsado','devuelto','incidencia']);

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
  return `<span class="tt-profile-status tt-profile-status--${status}" data-order-status="${status}">${escapeHtml(orderStatusLabel(order))}</span>`;
}
function paymentText(order) {
  const payment = order.payment;
  const method = clean(order.paymentMethod || (typeof payment === 'object' ? payment?.method : payment) || 'A confirmar');
  const state = clean(order.paymentStatus || (typeof payment === 'object' ? payment?.status : ''));
  const label = {pendiente:'Pago pendiente',parcial:'Parcialmente pagado',pagado:'Pagado',rechazado:'Pago rechazado',cancelado:'Pago cancelado',reembolsado:'Reembolsado'}[state];
  return label ? `${method} · ${label}` : method;
}
function deliveryText(order) {
  return clean(order.shippingMethod || order.deliveryMethod || order.delivery?.method || 'A coordinar');
}
function addressText(order) {
  return clean(order.shipping?.address || order.address || order.deliveryAddress || order.delivery?.address || order.shipping?.city || order.city || 'Sin dirección registrada');
}
function timeline(order) {
  const status = statusOf(order);
  if (terminal.has(status)) return `<p class="tt-profile-status tt-profile-status--cancelado">${escapeHtml(statusLabels[status])}</p>`;
  return `<p>${escapeHtml(customerOrderMessage(order))}</p><div class="tt-profile-timeline" aria-label="Seguimiento del pedido">${orderTimeline(order).map(stage => `<span class="tt-profile-step ${stage.done ? 'is-done' : ''}">${escapeHtml(stage.label)}</span>`).join('')}</div>`;
}
function orderDisplayNumber(order) {
  return clean(order.orderNumber || order.shortId || order.id) || 'Sin número';
}

function orderMarkup(order) {
  const id = clean(order.id);
  const displayNumber = orderDisplayNumber(order);
  const anchor = id.replace(/[^A-Za-z0-9_-]/g,'').slice(0,200);
  const date = dateOf(order.createdAt || order.updatedAt);
  const dateText = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-PY',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'Fecha no disponible';
  const items = Array.isArray(order.items) ? order.items : [];
  const lines = items.map(item => {
    const qty = Math.max(1,Number(item.qty || item.quantity) || 1);
    return `<div class="tt-profile-order-line"><span>${qty}x ${escapeHtml(item.name || 'Producto')}${item.variant ? ` · ${escapeHtml(item.variant)}` : ''}</span><strong>${money((Number(item.price)||0)*qty)}</strong></div>`;
  }).join('');
  const summary = items.slice(0,3).map(item => `${Math.max(1,Number(item.qty || item.quantity)||1)}x ${escapeHtml(item.name || 'Producto')}`).join(', ');
  const extra = items.length > 3 ? ` +${items.length-3} más` : '';
  const shippingDiscount = Math.max(0, Number(order.coupon?.shippingDiscount) || 0);
  const amount = value => value == null ? 'No registrado' : money(value);
  const breakdown = `<div class="tt-profile-order-line"><span>Subtotal de productos</span><strong>${amount(order.subtotal)}</strong></div><div class="tt-profile-order-line"><span>Envío</span><strong>${(order.shippingMethod || order.shipping?.method) === 'encomienda' && (order.shippingPending || Number(order.shippingCost) === 0) ? 'Sólo el envío se paga a la transportadora al recibir; producto por transferencia previa' : order.shippingPending ? 'A coordinar' : amount(order.shippingCost == null ? null : Number(order.shippingCost) + shippingDiscount)}</strong></div>${shippingDiscount ? `<div class="tt-profile-order-line"><span>Descuento de envío</span><strong>−${money(shippingDiscount)}</strong></div>` : ''}`;
  const invoice = order.invoice?.wanted ? `<div><strong>Factura solicitada</strong>${escapeHtml(order.invoice.taxpayerType === 'fisica' ? 'Persona física' : order.invoice.taxpayerType === 'juridica' ? 'Persona jurídica' : 'Tipo no registrado')}<br>${escapeHtml(order.invoice.razonSocial)}<br>RUC: ${escapeHtml(order.invoice.ruc)}</div>` : '';
  return `<article class="perfil-order-row" id="pedido-${anchor}" data-order-id="${escapeHtml(id)}" aria-label="Pedido ${escapeHtml(displayNumber)}"><div class="tt-profile-order-head"><h3 class="tt-profile-order-meta">Pedido #${escapeHtml(displayNumber)}<span class="tt-profile-order-date">${dateText}</span></h3>${statusBadge(order)}</div><div class="tt-profile-order-items">${summary || 'Sin detalle de productos'}${extra}</div><div class="tt-profile-order-total">Total: ${money(order.total)}</div><details class="tt-profile-order-details"><summary>Ver seguimiento y detalle</summary>${timeline(order)}<div class="tt-profile-order-grid"><div><strong>Pago</strong>${escapeHtml(paymentText(order))}</div><div><strong>Entrega</strong>${escapeHtml(deliveryText(order))}</div><div><strong>Dirección</strong>${escapeHtml(addressText(order))}</div><div><strong>Número de pedido</strong>${escapeHtml(displayNumber)}</div><div class="tt-profile-order-lines"><strong>Productos</strong>${lines || 'Sin detalle de productos'}${breakdown}<div class="tt-profile-order-line"><span>Total</span><strong>${money(order.total)}</strong></div></div>${invoice}</div></details></article>`;
}

export function createProfileOrdersController({ readIndexPage, subscribe, subscribeRevision = () => () => {}, render, onStatus, onStats, requestedId = () => '' }) {
  let generation = 0, revision = 0, identity = null, user = null;
  let abort = null, stopRevision = null, visible = 5;
  let index = new Map(), details = new Map(), listeners = new Map(), pending = new Set(), failures = new Map();
  let current = [], indexReady = false, indexFailure = null;
  const ordered = () => [...index.values()].sort((a,b) => timestamp(b)-timestamp(a) || String(a.id).localeCompare(String(b.id)));
  const wanted = () => {
    const ids = ordered().slice(0,visible).map(order => order.id);
    const requested = requestedId();
    if (index.has(requested) && !ids.includes(requested)) ids.push(requested);
    return ids;
  };
  function paint() {
    const ids = wanted();
    current = ids.map(id => details.get(id)).filter(Boolean).sort((a,b) => timestamp(b)-timestamp(a));
    const failed = indexFailure || [...failures.values()][0];
    const complete = indexReady && !failed;
    onStats(complete ? calculateOrderStats([...index.values()]) : null);
    render(current,{loading:!indexReady || pending.size>0, empty:complete && index.size===0, partial:!!failed, stale:!!failed && current.length>0, error:failed && !current.length ? failed : null, hasMore:complete && visible<index.size});
    onStatus(failed ? current.length ? 'partial' : 'error' : !indexReady || pending.size ? 'loading' : 'ready', failed || null);
  }
  function clearListeners() {
    listeners.forEach(stop => stop());
    listeners.clear();
    pending.clear();
    failures.clear();
  }
  function syncListeners(token, operation) {
    const ids = wanted();
    for (const [id,stop] of listeners) if (!ids.includes(id)) {stop(); listeners.delete(id); details.delete(id); pending.delete(id); failures.delete(id);}
    for (const id of ids) {
      if (listeners.has(id)) continue;
      pending.add(id);
      // Registrar primero: un adaptador puede responder sincrónicamente.
      listeners.set(id,()=>{});
      const stop = subscribe(id, order => {
        if (token !== generation || operation !== revision) return;
        pending.delete(id); failures.delete(id);
        if (order) {details.set(id,{...order,id}); index.set(id,{...order,id});}
        else {details.delete(id); index.delete(id);}
        paint();
      }, error => {
        if (token !== generation || operation !== revision) return;
        pending.delete(id); failures.set(id,error); paint();
      });
      if (token !== generation || operation !== revision) stop?.();
      else listeners.set(id,stop || (()=>{}));
    }
    paint();
  }
  async function refresh() {
    if (!user) return;
    abort?.abort();
    clearListeners();
    const token = generation, operation = ++revision, actor = user;
    abort = new AbortController();
    const signal = abort.signal;
    indexReady=false; indexFailure=null;
    onStats(null); onStatus('loading');
    render(current,{loading:true,stale:current.length>0});
    try {
      const rows = new Map(), seen = new Set();
      let cursor='', readTime='';
      do {
        const page = await readIndexPage({user:actor,cursor,readTime,signal});
        if (token !== generation || operation !== revision) return;
        if (!Array.isArray(page.items) || page.items.some(row=>!row || typeof row.id!=='string' || !row.id)) throw new Error('Índice de historial inválido.');
        if (readTime && page.readTime !== readTime) throw new Error('La revisión del historial cambió durante la lectura.');
        if (page.cursor && (!page.readTime || seen.has(page.cursor))) throw new Error('El historial no pudo avanzar.');
        page.items.forEach(row => rows.set(row.id,row));
        cursor=page.cursor || ''; readTime=page.readTime || readTime;
        if(cursor)seen.add(cursor);
      } while(cursor);
      index=new Map(ordersForView([...rows.values()]).map(order=>[order.id,order]));
      indexReady=true;
      for (const id of details.keys()) if (!index.has(id)) details.delete(id);
      syncListeners(token,operation);
    } catch(error) {
      if(token!==generation || operation!==revision || signal.aborted)return;
      indexFailure=error; paint();
    }
  }
  function stop() {
    generation++; revision++;
    abort?.abort(); abort=null;
    clearListeners(); stopRevision?.(); stopRevision=null;
    identity=null; user=null; index.clear(); details.clear(); current=[]; indexReady=false; indexFailure=null;
  }
  function start(actor) {
    stop(); visible=5;
    if(!actor?.uid) {render([],{empty:true,reset:true}); onStats(null); onStatus('signed-out'); return Promise.resolve();}
    user=actor; identity={uid:actor.uid,email:clean(actor.email).toLowerCase()};
    const token=generation;
    stopRevision=subscribeRevision(actor,()=>{if(token===generation)void refresh();},error=>{if(token===generation){indexFailure=error;paint();}});
    return refresh();
  }
  return {start,stop,refresh,more(){visible+=10;if(indexReady)syncListeners(generation,revision);},reveal(){if(indexReady)syncListeners(generation,revision);},get identity(){return identity;},get orders(){return current.slice();}};
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
  let currentUser = null;
  let authStop = null;
  let permissionRecoveryAttempted = false;
  let stopped = false;
  let focusedOrderId = '';
  const render = (orders,options={}) => {
    if (card) card.style.display = 'block';
    if (options.reset) { list.replaceChildren(); list.setAttribute('aria-busy','true'); return; }
    if (options.error && !options.stale) { list.innerHTML = '<div class="tt-profile-state" role="alert">No pudimos cargar tus pedidos. <button type="button" class="perfil-btn perfil-btn-outline" data-profile-orders-retry>Reintentar</button></div>'; list.setAttribute('aria-busy','false'); return; }
    if (options.empty) { list.innerHTML = '<div class="tt-profile-state">Todavía no tenés pedidos.<br><a href="/catalogo" class="perfil-btn perfil-btn-outline">Ver productos →</a></div>'; list.setAttribute('aria-busy','false'); return; }
    const focusedMore = document.activeElement?.matches?.('[data-profile-orders-more]');
    const openIds = new Set([...list.querySelectorAll('article[data-order-id] details[open]')].map(node=>node.closest('article').dataset.orderId));
    const requested = String(location.hash||'').match(/^#pedido-([A-Za-z0-9_-]+)$/)?.[1];
    if(options.loading && !orders.length) {list.innerHTML='<div class="tt-profile-state">Cargando pedidos…</div>';list.setAttribute('aria-busy','true');return;}
    list.innerHTML = orders.map(orderMarkup).join('') + (options.hasMore ? '<button type="button" class="perfil-btn perfil-btn-outline" data-profile-orders-more>Cargar más pedidos</button>' : '') + (options.partial ? '<button type="button" class="perfil-btn perfil-btn-outline" data-profile-orders-retry>Reintentar sincronización</button>' : '');
    for (const article of list.querySelectorAll('article[data-order-id]')) if (openIds.has(article.dataset.orderId)) article.querySelector('details')?.setAttribute('open','');
    list.setAttribute('aria-busy',String(Boolean(options.loading)));
    if(focusedMore)list.querySelector('[data-profile-orders-more]')?.focus({preventScroll:true});
    if (requested) {
      const target=document.getElementById(`pedido-${requested}`);
      if (target) {
        target.querySelector('details')?.setAttribute('open','');
        if (focusedOrderId !== requested) {
          focusedOrderId = requested;
          requestAnimationFrame(() => {
            target.setAttribute('tabindex','-1');
            target.focus({preventScroll:true});
          });
        }
      }
    }
  };
  window.addEventListener('hashchange', () => controller.reveal());
  const profileAppCheckReady = async () => {
    if (window.TintinAppCheckStatus === 'enabled') return true;
    const ready = await Promise.resolve(appCheckReady).catch(() => false);
    return ready === true || window.TintinAppCheckStatus === 'enabled';
  };
  const secureUnavailable = () => { status.dataset.state='error'; status.textContent='No pudimos validar la conexión segura para sincronizar tus pedidos. Reintentaremos cuando esté disponible.'; };
  const controller = createProfileOrdersController({
    readIndexPage: readAccountOrdersIndexPage,
    requestedId: () => String(location.hash||'').match(/^#pedido-([A-Za-z0-9_-]+)$/)?.[1] || '',
    subscribe: (id,next,fail) => onSnapshot(doc(db,'orders',id),snapshot=>next(snapshot.exists()?{...snapshot.data(),id:snapshot.id}:null),fail),
    subscribeRevision: (user,next,fail) => {
      let previous=null;
      return onSnapshot(doc(db,'users',user.uid),snapshot=>{
        const data=snapshot.data()||{};
        const signature=JSON.stringify([data.profileStatsUpdatedAt,data.orderStats,data.orderCount,data.totalSpent]);
        if(previous!==null && previous!==signature)next();
        previous=signature;
      },fail);
    },
    render,
    onStatus: (state,error) => {
      status.dataset.state=state;
      status.textContent=state==='partial'?'Sincronización incompleta. Se muestran los pedidos disponibles; reintentá para completar el historial.':state==='ready'?'Pedidos sincronizados':state==='loading'?'Sincronizando pedidos…':state==='signed-out'?'':state==='error'?(navigator.onLine===false?'Sin conexión. Tus pedidos no se pudieron actualizar.':'No pudimos sincronizar tus pedidos. Se conservan los últimos datos confirmados.'):'';
      if (state === 'ready' && !error) permissionRecoveryAttempted = false;
      if (error) {
        console.warn('[profile-orders]',error);
        const code = String(error?.code || error?.name || '').replace(/^firestore\//,'').toLowerCase();
        if (['error','partial'].includes(state) && ['permission-denied','unauthenticated'].includes(code) && !permissionRecoveryAttempted) {
          permissionRecoveryAttempted = true;
          window.setTimeout(() => void retry(true), 0);
        }
      }
    },
    onStats: stats => { if(count)count.textContent=stats?String(stats.totalOrders):'—'; if(total)total.textContent=stats?money(stats.totalSpent):'—'; if(stats)window.dispatchEvent(new CustomEvent('tintin:profile-orders',{detail:{count:stats.totalOrders,total:stats.totalSpent}})); }
  });
  const retry = async (refreshIdentity = false) => {
    if (!currentUser || stopped) return;
    status.textContent='Sincronizando pedidos…';
    if (refreshIdentity) {
      try { await currentUser.getIdToken(true); } catch (error) { console.warn('[profile-orders] No se pudo refrescar la identidad:', error); return; }
    }
    const secure = await profileAppCheckReady();
    if (!secure) { secureUnavailable(); return; }
    if (!stopped && getSessionUser()?.uid===currentUser.uid) void controller.refresh();
  };
  list.addEventListener('click',event=>{ if(event.target.closest('[data-profile-orders-more]')){controller.more();} if(event.target.closest('[data-profile-orders-retry]'))void retry(); });
  const onOnline = () => void retry();
  const onVisible = () => { if(!document.hidden && ['error','partial'].includes(status.dataset.state))void retry(); };
  const onAppCheckReady = event => { if (event?.detail?.ready === true) void retry(); };
  window.addEventListener('online',onOnline);
  window.addEventListener('tintin:app-check-ready',onAppCheckReady);
  document.addEventListener('visibilitychange',onVisible);
  window.addEventListener('pagehide',()=>{stopped=true;controller.stop();authStop?.();window.removeEventListener('online',onOnline);window.removeEventListener('tintin:app-check-ready',onAppCheckReady);document.removeEventListener('visibilitychange',onVisible);},{once:true});
  authStop=subscribeSession(snapshot=>{
    if(stopped || snapshot.status===AUTH_STATES.RESTORING) return;
    if(snapshot.status===AUTH_STATES.UNKNOWN){ status.textContent='Verificando tu sesión…'; return; }
    const user=snapshot.user;
    if(user?.uid!==currentUser?.uid) {
      controller.stop(); render([],{reset:true});
      if(count)count.textContent='—'; if(total)total.textContent='—';
    }
    currentUser=user;
    permissionRecoveryAttempted=false;
    void (async()=>{const secure=user?await profileAppCheckReady():true;if(user&&!secure){secureUnavailable();return;}if(!stopped && getSessionUser()?.uid===user?.uid)controller.start(user);})();
  });
  window.TintinProfileOrders={refresh:retry,stop:()=>controller.stop()};
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',startProfileOrders,{once:true});
  else startProfileOrders();
}
