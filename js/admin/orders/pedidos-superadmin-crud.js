import { mergeSelectedOrderProducts } from './seleccion-productos-pedido.mjs?v=tintin-20261018-products-master-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20261015-images-1';
import { chooseOrderTrash } from './seleccion-devolucion.mjs?v=tintin-20261017-stat-controls-1';
import { withAdminSiteChange } from '../../core/store/publicar-cambio-administrativo.js?v=tintin-20261017-domain-cutover-1';
import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20261017-domain-cutover-1';
import { authenticatedFetch } from '../../core/auth/cliente-api-autenticado.js?v=tintin-20261022-avatar-inicial-1';
import { allowedOrderStatuses, ORDER_LIFECYCLE_STATUSES, orderStatusLabel } from '../../orders/ciclo-pedido.mjs?v=tintin-20261012-orders-board-1';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SEQUENCE_REF = doc(db, 'settings', 'orderSequence');
const TRASH_COLLECTION = 'orderTrash';
const ACTIVE_COLLECTION = 'orders';
let ensureQueue = Promise.resolve();
let modalState = null;
let modalReturnFocus = null;
let catalogCache = [];

function isSuperAdmin() {
  return String(auth.currentUser?.email || '').trim().toLowerCase() === String(SUPER_ADMIN || '').trim().toLowerCase();
}

function assertSuperAdmin() {
  if (!isSuperAdmin()) throw new Error('Esta acción es exclusiva de Super Admin.');
}

function toast(message, duration = 4200) {
  if (typeof window.toast === 'function') return window.toast(message, duration);
  console.info('[TINPED]', message);
}

function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/[<>]/g, '').trim().slice(0, max);
}

function money(value) {
  const parsed = Number(String(value == null ? '' : value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatOrderNumber(number) {
  const n = Math.max(1, Math.floor(Number(number) || 1));
  return `TINPED${String(n).padStart(2, '0')}`;
}

function orderNumberOf(order) {
  return clean(order?.orderNumber || order?.shortId || order?.id || '', 80);
}

async function allocateSequence_(transaction) {
  const seqSnap = await transaction.get(SEQUENCE_REF);
  const current = Math.max(0, Math.floor(Number(seqSnap.exists() ? seqSnap.data()?.lastNumber : 0) || 0));
  const next = current + 1;
  transaction.set(SEQUENCE_REF, {
    lastNumber: next,
    lastCode: formatOrderNumber(next),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email || SUPER_ADMIN
  }, { merge: true });
  return { number: next, code: formatOrderNumber(next) };
}

async function ensureOrderNumber(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) return null;
  return runTransaction(db, async transaction => {
    const orderRef = doc(db, ACTIVE_COLLECTION, safeId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) return null;
    const data = orderSnap.data() || {};
    if (clean(data.orderNumber, 80)) return data.orderNumber;
    const allocated = await allocateSequence_(transaction);
    transaction.update(orderRef, {
      orderNumber: allocated.code,
      shortId: allocated.code,
      orderSequenceNumber: allocated.number,
      orderNumberAssignedAt: serverTimestamp(),
      orderNumberAssignedBy: auth.currentUser?.email || SUPER_ADMIN,
      updatedAt: serverTimestamp()
    });
    return allocated.code;
  });
}

function ensureMissingOrderNumbers(orders) {
  if (!isSuperAdmin()) return Promise.resolve();
  const missing = (Array.isArray(orders) ? orders : [])
    .filter(order => order?.id && !clean(order.orderNumber, 80))
    .sort((a, b) => timestampMs(a.createdAt) - timestampMs(b.createdAt));
  if (!missing.length) return ensureQueue;
  ensureQueue = ensureQueue.then(async () => {
    for (const order of missing) {
      try { await ensureOrderNumber(order.id); }
      catch (error) { console.warn('[TINPED] No se pudo asignar número a', order.id, error); }
    }
  });
  return ensureQueue;
}

async function resetOrderSequence() {
  assertSuperAdmin();
  const typed = window.prompt('TINPED ya no se puede reiniciar porque los códigos no deben reutilizarse. Escribí VERIFICAR TINPED para confirmar la protección de la secuencia:');
  if (typed !== 'VERIFICAR TINPED') return { reset: false, cancelled: true };
  const response = await authenticatedFetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'resetOrderSequence' }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) throw new Error(body.error || 'No se pudo verificar la secuencia TINPED.');
  const next = body.result?.nextOrderNumber || 'el siguiente código correlativo';
  toast(`Secuencia protegida. Próximo código previsto: ${next}.`);
  return body.result || { reset: false, protected: true };
}

async function commerceControl(body) {
  const response = await authenticatedFetch('/api/admin-commerce-controls', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.error || 'No se pudo actualizar el pedido.');
  return data.result;
}

async function trashOrder(orderId, reason = '', options = null) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  const snapshot = await getDoc(doc(db, ACTIVE_COLLECTION, safeId));
  if (!snapshot.exists()) return { moved: false, missing: true };
  const before = { ...snapshot.data(), id: safeId };
  if (!options) {
    const selection = await chooseOrderTrash([before]);
    if (!selection) return { moved: false, cancelled: true };
    options = selection.selections[safeId]; reason = selection.reason;
  }
  if ((before.lastChangeId || '') !== options.baseChangeId) throw new Error('El pedido cambió en otra sesión. Actualizá antes de elegir la devolución.');
  return commerceControl({ action: 'trashOrder', orderId: safeId, reason,
    returnItems: options.returnItems, baseChangeId: options.baseChangeId,
    changeId: 'trash_' + crypto.randomUUID().replaceAll('-', '') });
}

async function restoreOrder(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  const snapshot = await getDoc(doc(db, TRASH_COLLECTION, safeId));
  if (!snapshot.exists()) return { restored: false, missing: true };
  const before = snapshot.data();
  if (!window.confirm('¿Restaurar el pedido? Se descontarán sólo las unidades devueltas al borrarlo. Si no hay stock suficiente, no se hará ningún cambio.')) return { restored: false, cancelled: true };
  return commerceControl({ action: 'restoreOrder', orderId: safeId,
    baseChangeId: before.trashMeta?.changeId || before.lastChangeId || '',
    changeId: 'restore_' + crypto.randomUUID().replaceAll('-', '') });
}

async function deleteTrashPermanently(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  const typed = window.prompt(`Eliminar definitivamente ${safeId} de Borrados. Esta copia ya no se podrá recuperar. Escribí ELIMINAR para continuar:`);
  if (typed !== 'ELIMINAR') return { deleted: false, cancelled: true };
  await withAdminSiteChange(async () => deleteDoc(doc(db, TRASH_COLLECTION, safeId)));
  toast('Pedido eliminado definitivamente de Borrados.');
  return { deleted: true };
}

async function loadCatalog_() {
  const snap = await getDocs(query(collection(db, 'products'), limit(1000)));
  catalogCache = snap.docs.map(item => ({ id: item.id, ...item.data() }))
    .filter(product => product.active !== false)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
  return catalogCache;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function ensureModal_() {
  let overlay = document.getElementById('tinped-crud-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'tinped-crud-overlay';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'tinped-modal-title');
  overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:5200;background:rgba(0,0,0,.5);overflow:auto;padding:18px';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:980px;margin:auto;box-shadow:0 18px 60px rgba(0,0,0,.22);overflow:hidden">
      <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #eadde2">
        <div><strong id="tinped-modal-title" style="font-size:17px">Pedido</strong><div id="tinped-modal-subtitle" style="font-size:11px;color:#766a70;margin-top:3px"></div></div>
        <button type="button" id="tinped-modal-close" class="adm-btn">Cerrar</button>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px" id="tinped-crud-form">
        <label class="adm-field">Código visible<input id="tinped-code" class="adm-input" placeholder="Automático"></label>
        <label class="adm-field">Estado<select id="tinped-status" class="adm-input"><option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="preparando">En preparación</option><option value="listo_retiro">Listo para retirar</option><option value="en_camino">En camino</option><option value="entregado">Entregado</option><option value="cancelado">Cancelado</option><option value="rechazado">Rechazado</option></select></label>
        <label class="adm-field">Nombre del cliente<input id="tinped-name" class="adm-input"></label>
        <label class="adm-field">Teléfono<input id="tinped-phone" class="adm-input"></label>
        <label class="adm-field">Email<input id="tinped-email" type="email" class="adm-input"></label>
        <label class="adm-field">Ciudad<input id="tinped-city" class="adm-input"></label>
        <label class="adm-field">Entrega<select id="tinped-shipping-method" class="adm-input"><option value="delivery">Delivery</option><option value="encomienda">Encomienda</option><option value="retiro">Retiro</option></select></label>
        <label class="adm-field">Costo de envío<input id="tinped-shipping-cost" type="number" min="0" class="adm-input" value="0"></label>
        <label class="adm-field">Dirección<input id="tinped-address" class="adm-input"></label>
        <label class="adm-field">Referencia<input id="tinped-reference" class="adm-input"></label>
        <label class="adm-field">Método de pago<select id="tinped-pay-method" class="adm-input"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="paypal">PayPal</option></select></label>
        <label class="adm-field">Estado de pago<select id="tinped-pay-status" class="adm-input"><option value="pendiente">Pago pendiente</option><option value="pagado">Pagado</option><option value="rechazado">Rechazado</option><option value="cancelado">Cancelado</option><option value="reembolsado">Reembolsado</option></select></label>
        <label class="adm-field" style="grid-column:1/-1">Nota interna<input id="tinped-notes" class="adm-input"></label>
        <div style="grid-column:1/-1;border-top:1px solid #eadde2;padding-top:14px">
          <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:12px"><label class="adm-field tinped-picker-field" style="flex:1;min-width:220px">Agregar producto<select id="tinped-product-picker" class="adm-input"></select></label><button type="button" id="tinped-add-product" class="adm-btn">+ Agregar</button></div>
          <div id="tinped-items"></div>
          <div id="tinped-total" style="text-align:right;font-weight:800;padding:12px 0">Total: 0 Gs</div>
        </div>
      </div>
      <div id="tinped-error" role="alert" tabindex="-1" style="display:none;margin:0 20px 16px;color:var(--admin-color-error-text)"></div>
      <div style="padding:16px 22px;border-top:1px solid #eadde2;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="tinped-save" class="adm-btn adm-btn-primary">Guardar pedido</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#tinped-modal-close').addEventListener('click', closeModal_);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal_(); });
  overlay.querySelector('#tinped-add-product').addEventListener('click', addSelectedProduct_);
  overlay.querySelector('#tinped-save').addEventListener('click', saveModal_);
  overlay.querySelector('#tinped-items').addEventListener('input', handleItemInput_);
  overlay.querySelector('#tinped-items').addEventListener('click', handleItemClick_);
  overlay.querySelector('#tinped-shipping-cost').addEventListener('input', updateTotal_);
  overlay.querySelector('#tinped-shipping-method').addEventListener('change', () => refreshModalStatuses_(modalState?.baseOrder, formEl_('tinped-status').value));
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation();event.preventDefault();closeModal_(); }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(el => el.getClientRects().length);
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
  });
  return overlay;
}

function formEl_(id) { return document.getElementById(id); }
function setValue_(id, value) { const el = formEl_(id); if (el) el.value = value == null ? '' : String(value); }

function renderPicker_() {
  const picker = formEl_('tinped-product-picker');
  if (!picker) return;
  picker.innerHTML = '<option value="">Elegí un producto…</option>' + catalogCache.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name || product.id)} · ${Math.round(Number(product.price) || 0).toLocaleString('es-PY')} Gs${product.stock == null ? '' : ` · stock ${Number(product.stock)}`}</option>`).join('');
}

function renderItems_() {
  const root = formEl_('tinped-items');
  if (!root || !modalState) return;
  root.innerHTML = modalState.items.map((item, index) => {
    const product=catalogCache.find(product=>product.id===(item.id || item.productId)),variants=Array.isArray(product?.variantInventory)?product.variantInventory:[];
    const variant=variants.length?`<select class="adm-input" data-item-field="variant" data-index="${index}"><option value="">Elegí una variante…</option>${variants.map(entry=>`<option value="${escapeHtml(entry.variant)}" ${item.variant===entry.variant?'selected':''}>${escapeHtml(entry.variant)} · stock ${Number(entry.stock)}</option>`).join('')}${item.variant && !variants.some(entry=>entry.variant===item.variant)?`<option value="${escapeHtml(item.variant)}" selected>${escapeHtml(item.variant)} (revisar disponibilidad)</option>`:''}</select>`:`<input class="adm-input" data-item-field="variant" data-index="${index}" value="${escapeHtml(item.variant || '')}">`;
    return `
    <div data-item-row="${index}" style="display:grid;grid-template-columns:92px minmax(0,1.5fr) minmax(0,.7fr) 80px 120px 44px;gap:8px;align-items:end;padding:9px 0;border-bottom:1px solid #f2e8ec">
      <img class="tinped-item-image" src="${escapeHtml(sanitizeImageUrl(item.imageUrl || item.image || product?.imageUrl || product?.image || ''))}" alt="${escapeHtml(item.name || 'Producto')}">
      <label class="adm-field">Producto<input class="adm-input" data-item-field="name" data-index="${index}" value="${escapeHtml(item.name || '')}"></label>
      <label class="adm-field">Variante${variant}</label>
      <label class="adm-field">Cant.<input class="adm-input" type="number" min="1" max="99" step="1" data-item-field="qty" data-index="${index}" value="${Math.max(1, Number(item.qty) || 1)}"></label>
      <label class="adm-field">Precio<input class="adm-input" type="number" min="0" data-item-field="price" data-index="${index}" value="${money(item.price)}"></label>
      <button type="button" class="adm-btn adm-btn-danger" data-remove-item="${index}" aria-label="Quitar ${escapeHtml(item.name || 'producto')}">×</button>
    </div>`;}).join('') || '<div style="padding:14px;color:#766a70;text-align:center">Agregá al menos un producto.</div>';
  updateTotal_();
}

function updateTotal_(){
  if(!modalState)return;
  const subtotal = modalState.items.reduce((sum, item) => sum + money(item.price) * Math.max(1, Number(item.qty) || 1), 0);
  const total = subtotal + money(formEl_('tinped-shipping-cost')?.value);
  formEl_('tinped-total').textContent = `Total: ${total.toLocaleString('es-PY')} Gs`;
}

function addSelectedProduct_() {
  if (!modalState) return;
  const id = formEl_('tinped-product-picker')?.value;
  const product = catalogCache.find(item => item.id === id);
  if (!product) return;
  modalState.items.push({ id: product.id, name: product.name || product.id, cat: product.category || '', price: money(product.price), qty: 1, variant: '', imageUrl: product.imageUrl || product.image || '' });
  renderItems_();
}

function handleItemInput_(event) {
  const input = event.target.closest('[data-item-field]');
  if (!input || !modalState) return;
  const index = Number(input.dataset.index);
  const item = modalState.items[index];
  if (!item) return;
  const field = input.dataset.itemField;
  if (field === 'qty') item.qty = input.value==='' ? NaN : Number(input.value);
  else if (field === 'price') item.price = input.value==='' ? NaN : Number(input.value);
  else item[field] = clean(input.value, field === 'name' ? 180 : 120);
  updateTotal_();
}

function handleItemClick_(event) {
  const button = event.target.closest('[data-remove-item]');
  if (!button || !modalState) return;
  modalState.items.splice(Number(button.dataset.removeItem), 1);
  renderItems_();
}

function refreshModalStatuses_(order, selected = order?.status || 'pendiente') {
  const method = formEl_('tinped-shipping-method').value || 'delivery';
  const context = { ...order, shippingMethod: method };
  const statuses = order && !order.localEntryId ? allowedOrderStatuses(context) : ORDER_LIFECYCLE_STATUSES;
  formEl_('tinped-status').innerHTML = '<option value="" disabled>Elegí un estado compatible</option>' + statuses.filter(value => ORDER_LIFECYCLE_STATUSES.includes(value) && (value !== 'listo_retiro' || method === 'retiro') && (value !== 'en_camino' || method !== 'retiro')).map(value => `<option value="${value}">${orderStatusLabel({ ...context, status: value })}</option>`).join('');
  setValue_('tinped-status', selected === 'enviado' ? 'en_camino' : selected);
}
function fillModal_(order) {
  const error=formEl_('tinped-error');if(error){error.textContent='';error.style.display='none';}
  if (!formEl_('tinped-pay-status').querySelector('option[value="parcial"]')) {
    const option = document.createElement('option'); option.value = 'parcial'; option.textContent = 'Parcialmente pagado'; formEl_('tinped-pay-status').appendChild(option);
  }
  setValue_('tinped-code', order?.orderNumber || order?.shortId || '');
  setValue_('tinped-name', order?.userName || '');
  setValue_('tinped-phone', order?.userPhone || '');
  setValue_('tinped-email', order?.contactEmail || order?.userEmail || '');
  setValue_('tinped-city', order?.shipping?.city || order?.city || '');
  setValue_('tinped-shipping-method', order?.shipping?.method || 'delivery');
  refreshModalStatuses_(order);
  setValue_('tinped-shipping-cost', money(order?.shippingCost));
  setValue_('tinped-address', order?.shipping?.address || order?.address || '');
  setValue_('tinped-reference', order?.shipping?.referencia || order?.shipping?.reference || '');
  setValue_('tinped-pay-method', order?.payment?.method || order?.paymentMethod || 'efectivo');
  const paymentValue = order?.paymentStatus || order?.payment?.status || 'pendiente';
  const paymentSelect = formEl_('tinped-pay-status');
  paymentSelect.querySelectorAll('option[data-legacy-payment]').forEach(option => option.remove());
  if (![...paymentSelect.options].some(option => option.value === paymentValue)) { const legacy = document.createElement('option'); legacy.value = paymentValue; legacy.dataset.legacyPayment = 'true'; legacy.textContent = 'Estado de pago no reconocido'; paymentSelect.appendChild(legacy); }
  setValue_('tinped-pay-status', order?.paymentStatus || order?.payment?.status || 'pendiente');
  setValue_('tinped-notes', order?.notes || '');
}

function collectPatch_() {
  for(const item of modalState?.items || []){
    if(!Number.isInteger(item.qty ?? item.quantity) || (item.qty ?? item.quantity)<1 || (item.qty ?? item.quantity)>99 || !Number.isInteger(Number(item.price)) || Number(item.price)<0)throw Error('Cada línea debe tener de 1 a 99 unidades y un precio entero válido.');
    const product=catalogCache.find(product=>product.id===(item.id || item.productId));
    if(Array.isArray(product?.variantInventory) && !product.variantInventory.some(entry=>entry.variant===item.variant))throw Error('Elegí una variante válida para cada producto con stock por opción.');
  }
  const items = (modalState?.items || []).map(item => ({
    id: clean(item.id || item.productId, 180),
    name: clean(item.name, 180) || 'Producto',
    cat: clean(item.cat, 120),
    price: money(item.price),
    qty: Number(item.qty ?? item.quantity),
    variant: clean(item.variant, 120),
    imageUrl: clean(item.imageUrl, 900)
  }));
  if (!items.length) throw new Error('El pedido debe tener al menos un producto.');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingCost = money(formEl_('tinped-shipping-cost')?.value);
  const status = clean(formEl_('tinped-status')?.value, 40);
  if (!status) throw new Error('Elegí un estado compatible con la entrega.');
  const payStatus = clean(formEl_('tinped-pay-status')?.value, 40) || 'pendiente';
  const payMethod = clean(formEl_('tinped-pay-method')?.value, 40) || 'efectivo';
  const shippingMethod = clean(formEl_('tinped-shipping-method')?.value, 40) || 'delivery';
  return {
    orderNumber: clean(formEl_('tinped-code')?.value, 80),
    shortId: clean(formEl_('tinped-code')?.value, 80),
    userName: clean(formEl_('tinped-name')?.value, 120),
    userPhone: clean(formEl_('tinped-phone')?.value, 40),
    userEmail: clean(formEl_('tinped-email')?.value, 254).toLowerCase(),
    contactEmail: clean(formEl_('tinped-email')?.value, 254).toLowerCase(),
    items,
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
    status,
    payment: { method: payMethod, status: payStatus },
    paymentStatus: payStatus,
    shipping: {
      ...(modalState?.baseOrder?.shipping || {}),
      method: shippingMethod,
      city: clean(formEl_('tinped-city')?.value, 120),
      address: clean(formEl_('tinped-address')?.value, 300),
      referencia: clean(formEl_('tinped-reference')?.value, 300)
    },
    notes: clean(formEl_('tinped-notes')?.value, 1000)
  };
}

async function callCanonicalCreate_(patch) {
  const user = auth.currentUser;
  if (!user) throw new Error('La sesión administrativa ya no está disponible.');
  const response = await authenticatedFetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      action: 'createOrder',
      userName: patch.userName,
      userPhone: patch.userPhone,
      contactEmail: patch.contactEmail,
      status: patch.status,
      payment: patch.payment,
      paymentStatus: patch.paymentStatus,
      shipping: patch.shipping,
      shippingCost: patch.shippingCost,
      notes: patch.notes,
      items: patch.items.map(item => ({ id: item.id, qty: item.qty, variant: item.variant || '' })),
      changeId: `admin_create_${crypto.randomUUID().replaceAll('-', '')}`,
      source: 'superadmin'
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const error = new Error(body.error || 'No se pudo crear el pedido.');
    error.status = response.status;
    throw error;
  }
  return body.result || {};
}

async function createManualOrder_(patch) {
  assertSuperAdmin();
  return callCanonicalCreate_(patch);
}

async function saveModal_() {
  if (!modalState || modalState.saving) return false;
  assertSuperAdmin();
  const savingState=modalState;savingState.saving=true;
  const overlay=document.getElementById('tinped-crud-overlay');
  const controls=[...overlay.querySelectorAll('button,input,select')].map(control=>[control,control.disabled]);
  controls.forEach(([control])=>control.disabled=true);
  const errorElement=formEl_('tinped-error');errorElement.textContent='';errorElement.style.display='none';
  const button = formEl_('tinped-save');
  const old = button.textContent;
  button.disabled = true;
  button.textContent = 'Guardando…';
  try {
    const patch = collectPatch_();
    if (!patch.userName) throw new Error('Ingresá el nombre del cliente.');
    if (modalState.mode === 'create') {
      const result = await createManualOrder_(patch);
      toast(`Pedido ${result.orderNumber} creado manualmente.`);
    } else {
      const orderId = modalState.orderId;
      if (!window.TintinInventoryIntegrity?.updateEditedOrder) throw new Error('El reconciliador de inventario no está disponible.');
      await window.TintinInventoryIntegrity.updateEditedOrder(orderId, { ...patch, baseChangeId: modalState.baseOrder?.lastChangeId || '' });
      toast(`Pedido ${patch.orderNumber || orderNumberOf(modalState.baseOrder)} actualizado.`);
    }
    closeModal_({force:true});
    return true;
  } catch (error) {
    console.error('[TINPED] guardar:', error);
    errorElement.textContent=error?.message || 'No se pudo guardar el pedido.';errorElement.style.display='';errorElement.focus();
    toast(errorElement.textContent, 6500);
    return false;
  } finally {
    savingState.saving=false;controls.forEach(([control,disabled])=>control.disabled=disabled);
    button.textContent = old;
  }
}

function closeModal_({force=false,remove=false}={}) {
  if(modalState?.saving && !force)return;
  const close=()=>{
    window.AdminUnsaved?.unregister('order-items-editor');
    const overlay=document.getElementById('tinped-crud-overlay');
    if(overlay){overlay.style.display='none';if(remove)overlay.remove();}
    document.documentElement.classList.remove('tt-product-order-open');
    modalState=null;modalReturnFocus?.focus?.({preventScroll:true});modalReturnFocus=null;
  };
  if(force)return close();
  if(window.AdminUnsaved)return window.AdminUnsaved.requestNavigation(close,{scopeIds:'order-items-editor'});
  if(!modalState || !modalState.openSnapshot || modalState.openSnapshot===serializeModal_() || window.confirm('¿Descartar los cambios sin guardar del pedido?'))close();
}
function serializeModal_(){
 const root=document.getElementById('tinped-crud-overlay');
 return JSON.stringify({items:modalState?.items || [],fields:[...(root?.querySelectorAll('input,select') || [])].map(el=>[el.id,el.dataset.itemField,el.value])});
}
function trackModal_(){
 modalState.openSnapshot=serializeModal_();
 window.AdminUnsaved?.register('order-items-editor',{root:'#tinped-crud-overlay',serialize:serializeModal_,save:saveModal_,label:'el pedido abierto'});
 document.documentElement.classList.add('tt-product-order-open');
}

async function openManualOrder() {
  modalReturnFocus = document.activeElement;
  assertSuperAdmin();
  await loadCatalog_();
  assertSuperAdmin();
  modalState = { mode: 'create', orderId: '', baseOrder: null, items: [] };
  const overlay = ensureModal_();
  formEl_('tinped-modal-title').textContent = 'Nuevo pedido manual';
  formEl_('tinped-modal-subtitle').textContent = 'TINPED, precios, total y stock se calculan automáticamente desde Firestore al guardar.';
  fillModal_({ status: 'pendiente', payment: { method: 'efectivo', status: 'pendiente' }, shipping: { method: 'delivery' } });
  const codeInput = formEl_('tinped-code');
  codeInput.value = '';
  codeInput.placeholder = 'Automático: próximo TINPED';
  codeInput.readOnly = true;
  codeInput.setAttribute('aria-readonly', 'true');
  renderPicker_();
  renderItems_();
  overlay.style.display = 'block';
  trackModal_();
  formEl_('tinped-modal-close').focus();
}

async function openAdvancedOrderEditor(orderId,{productIds=[],returnFocus=null}={}) {
  assertSuperAdmin();
  if(!Array.isArray(productIds) || productIds.length>30 || new Set(productIds).size!==productIds.length || productIds.some(id=>typeof id!=='string' || !id || id.length>180 || id.includes('/')))throw Error('Selección de productos inválida.');
  const safeId=clean(orderId,180);
  if(!safeId || safeId.includes('/'))throw Error('Código o ID de pedido inválido.');
  modalReturnFocus=returnFocus || document.activeElement;
  await loadCatalog_();
  let snapshot=await getDoc(doc(db,ACTIVE_COLLECTION,safeId));
  let resolvedId=safeId;
  if(!snapshot.exists()){
    const matches=await getDocs(query(collection(db,ACTIVE_COLLECTION),where('orderNumber','==',safeId.toUpperCase()),limit(2)));
    if(matches.docs.length!==1)throw Error(matches.docs.length?'El código coincide con más de un pedido. Usá su ID exacto.':'El pedido ya no existe o su código no es válido.');
    snapshot=matches.docs[0];resolvedId=snapshot.id;
  }
  const order={...snapshot.data(),id:resolvedId};
  if(order.localEntryId)throw Error('Esta venta se edita en Ventas locales. No se modifica desde Productos.');
  const selected=[];
  for(const id of productIds){
    const productSnapshot=await getDoc(doc(db,'products',id));
    if(!productSnapshot.exists())throw Error('Un producto seleccionado ya no existe.');
    const product={...productSnapshot.data(),id};selected.push(product);
    const index=catalogCache.findIndex(item=>item.id===id);if(index<0)catalogCache.push(product);else catalogCache[index]=product;
  }
  const originalItems=(Array.isArray(order.items)?order.items:[]).map(item=>({...item,id:item.id || item.productId || '',qty:Number(item.qty ?? item.quantity ?? 1)}));
  const nextItems=mergeSelectedOrderProducts(originalItems,selected);
  assertSuperAdmin();
  modalState={mode:'edit',orderId:resolvedId,baseOrder:order,items:originalItems};
  const overlay=ensureModal_();
  formEl_('tinped-modal-title').textContent=`Editar pedido · ${orderNumberOf(order)}`;
  formEl_('tinped-modal-subtitle').textContent=productIds.length?`${order.userName || 'Cliente sin nombre'} · ${productIds.length} producto${productIds.length===1?'':'s'} agregado${productIds.length===1?'':'s'} al borrador. Revisá cantidades y variantes.`:`ID técnico: ${resolvedId}`;
  const codeInput=formEl_('tinped-code');codeInput.readOnly=false;codeInput.removeAttribute('aria-readonly');
  fillModal_(order);renderPicker_();renderItems_();overlay.style.display='block';trackModal_();
  if(productIds.length){modalState.items=nextItems;renderItems_();window.AdminUnsaved?.markDirty('order-items-editor');requestAnimationFrame(()=>formEl_('tinped-items')?.scrollIntoView({block:'start'}));}
  formEl_('tinped-modal-close').focus();
}

function interceptNewOrderButton_() {
  document.addEventListener('click', event => {
    const button = event.target.closest('.adm-topbar-btn');
    if (!button || !/nuevo pedido/i.test(button.textContent || '') || !isSuperAdmin()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openManualOrder().catch(error => toast(error?.message || 'No se pudo abrir el pedido manual.'));
  }, true);
}

interceptNewOrderButton_();

window.TintinOrderAdmin = Object.freeze({
  formatOrderNumber,
  orderNumberOf,
  ensureOrderNumber,
  ensureMissingOrderNumbers,
  resetOrderSequence,
  trashOrder,
  restoreOrder,
  deleteTrashPermanently,
  openManualOrder,
  openAdvancedOrderEditor
});

subscribeAuthState(user=>{if(!user || user.isAnonymous || String(user.email || '').trim().toLowerCase()!==String(SUPER_ADMIN).trim().toLowerCase()){closeModal_({force:true,remove:true});catalogCache=[];}});
