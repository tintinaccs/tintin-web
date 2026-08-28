import { auth, db } from '../../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN } from '../../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
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
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const SEQUENCE_REF = doc(db, 'settings', 'orderSequence');
const TRASH_COLLECTION = 'orderTrash';
const ACTIVE_COLLECTION = 'orders';
let ensureQueue = Promise.resolve();
let modalState = null;
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
  const typed = window.prompt('Esto hará que el PRÓXIMO pedido vuelva a TINPED01. Los pedidos históricos conservan su código. Escribí REINICIAR TINPED para continuar:');
  if (typed !== 'REINICIAR TINPED') return { reset: false, cancelled: true };
  await setDoc(SEQUENCE_REF, {
    lastNumber: 0,
    lastCode: '',
    resetAt: serverTimestamp(),
    resetBy: auth.currentUser?.email || SUPER_ADMIN,
    updatedAt: serverTimestamp()
  }, { merge: true });
  toast('Secuencia reiniciada. El próximo pedido será TINPED01.');
  return { reset: true };
}

async function trashOrder(orderId, reason = '') {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  const activeRef = doc(db, ACTIVE_COLLECTION, safeId);
  const beforeSnap = await getDoc(activeRef);
  if (!beforeSnap.exists()) return { moved: false, missing: true };
  const before = beforeSnap.data() || {};

  if (window.TintinInventoryIntegrity?.transitionStatus) {
    await window.TintinInventoryIntegrity.transitionStatus(safeId, 'cancelado');
  }

  return runTransaction(db, async transaction => {
    const liveSnap = await transaction.get(activeRef);
    if (!liveSnap.exists()) return { moved: false, missing: true };
    const live = liveSnap.data() || {};
    const trashRef = doc(db, TRASH_COLLECTION, safeId);
    transaction.set(trashRef, {
      ...live,
      originalOrderId: safeId,
      orderNumber: live.orderNumber || before.orderNumber || '',
      shortId: live.orderNumber || before.orderNumber || live.shortId || before.shortId || '',
      status: 'cancelado',
      inventoryState: 'released',
      trashMeta: {
        originalStatus: before.status || 'pendiente',
        reason: clean(reason, 500),
        trashedAt: serverTimestamp(),
        trashedBy: auth.currentUser?.email || SUPER_ADMIN
      },
      updatedAt: serverTimestamp()
    });
    transaction.delete(activeRef);
    return { moved: true, orderNumber: live.orderNumber || before.orderNumber || '' };
  });
}

async function restoreOrder(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  return runTransaction(db, async transaction => {
    const trashRef = doc(db, TRASH_COLLECTION, safeId);
    const activeRef = doc(db, ACTIVE_COLLECTION, safeId);
    const trashSnap = await transaction.get(trashRef);
    const activeSnap = await transaction.get(activeRef);
    if (!trashSnap.exists()) return { restored: false, missing: true };
    if (activeSnap.exists()) throw new Error('Ya existe un pedido activo con este ID interno.');
    const data = trashSnap.data() || {};
    const restored = { ...data };
    delete restored.trashMeta;
    restored.status = 'cancelado';
    restored.inventoryState = 'released';
    restored.restoredAt = serverTimestamp();
    restored.restoredBy = auth.currentUser?.email || SUPER_ADMIN;
    restored.updatedAt = serverTimestamp();
    transaction.set(activeRef, restored);
    transaction.delete(trashRef);
    return { restored: true, orderNumber: data.orderNumber || data.shortId || safeId };
  });
}

async function deleteTrashPermanently(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  if (!safeId || safeId.includes('/')) throw new Error('Pedido inválido.');
  const typed = window.prompt(`Eliminar definitivamente ${safeId} de Borrados. Esta copia ya no se podrá recuperar. Escribí ELIMINAR para continuar:`);
  if (typed !== 'ELIMINAR') return { deleted: false, cancelled: true };
  await deleteDoc(doc(db, TRASH_COLLECTION, safeId));
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
          <div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-bottom:12px"><label class="adm-field" style="flex:1;min-width:220px">Agregar producto<select id="tinped-product-picker" class="adm-input"></select></label><button type="button" id="tinped-add-product" class="adm-btn">+ Agregar</button></div>
          <div id="tinped-items"></div>
          <div id="tinped-total" style="text-align:right;font-weight:800;padding:12px 0">Total: 0 Gs</div>
        </div>
      </div>
      <div style="padding:16px 22px;border-top:1px solid #eadde2;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="tinped-save" class="adm-btn adm-btn-primary">Guardar pedido</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#tinped-modal-close').addEventListener('click', closeModal_);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeModal_(); });
  overlay.querySelector('#tinped-add-product').addEventListener('click', addSelectedProduct_);
  overlay.querySelector('#tinped-save').addEventListener('click', saveModal_);
  overlay.querySelector('#tinped-items').addEventListener('input', handleItemInput_);
  overlay.querySelector('#tinped-items').addEventListener('click', handleItemClick_);
  overlay.querySelector('#tinped-shipping-cost').addEventListener('input', renderItems_);
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
  root.innerHTML = modalState.items.map((item, index) => `
    <div data-item-row="${index}" style="display:grid;grid-template-columns:minmax(150px,1.5fr) minmax(90px,.7fr) 80px 120px 38px;gap:8px;align-items:end;padding:9px 0;border-bottom:1px solid #f2e8ec">
      <label class="adm-field">Producto<input class="adm-input" data-item-field="name" data-index="${index}" value="${escapeHtml(item.name || '')}"></label>
      <label class="adm-field">Variante<input class="adm-input" data-item-field="variant" data-index="${index}" value="${escapeHtml(item.variant || '')}"></label>
      <label class="adm-field">Cant.<input class="adm-input" type="number" min="1" data-item-field="qty" data-index="${index}" value="${Math.max(1, Number(item.qty) || 1)}"></label>
      <label class="adm-field">Precio<input class="adm-input" type="number" min="0" data-item-field="price" data-index="${index}" value="${money(item.price)}"></label>
      <button type="button" class="adm-btn adm-btn-danger" data-remove-item="${index}" title="Quitar">×</button>
    </div>`).join('') || '<div style="padding:14px;color:#766a70;text-align:center">Agregá al menos un producto.</div>';
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
  if (field === 'qty') item.qty = Math.max(1, Math.floor(Number(input.value) || 1));
  else if (field === 'price') item.price = money(input.value);
  else item[field] = clean(input.value, field === 'name' ? 180 : 120);
  renderItems_();
}

function handleItemClick_(event) {
  const button = event.target.closest('[data-remove-item]');
  if (!button || !modalState) return;
  modalState.items.splice(Number(button.dataset.removeItem), 1);
  renderItems_();
}

function fillModal_(order) {
  setValue_('tinped-code', order?.orderNumber || order?.shortId || '');
  setValue_('tinped-status', order?.status || 'pendiente');
  setValue_('tinped-name', order?.userName || '');
  setValue_('tinped-phone', order?.userPhone || '');
  setValue_('tinped-email', order?.contactEmail || order?.userEmail || '');
  setValue_('tinped-city', order?.shipping?.city || order?.city || '');
  setValue_('tinped-shipping-method', order?.shipping?.method || 'delivery');
  setValue_('tinped-shipping-cost', money(order?.shippingCost));
  setValue_('tinped-address', order?.shipping?.address || order?.address || '');
  setValue_('tinped-reference', order?.shipping?.referencia || order?.shipping?.reference || '');
  setValue_('tinped-pay-method', order?.payment?.method || order?.paymentMethod || 'efectivo');
  setValue_('tinped-pay-status', order?.paymentStatus || order?.payment?.status || 'pendiente');
  setValue_('tinped-notes', order?.notes || '');
}

function collectPatch_() {
  const items = (modalState?.items || []).map(item => ({
    id: clean(item.id, 180),
    name: clean(item.name, 180) || 'Producto',
    cat: clean(item.cat, 120),
    price: money(item.price),
    qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
    variant: clean(item.variant, 120),
    imageUrl: clean(item.imageUrl, 900)
  }));
  if (!items.length) throw new Error('El pedido debe tener al menos un producto.');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shippingCost = money(formEl_('tinped-shipping-cost')?.value);
  const status = clean(formEl_('tinped-status')?.value, 40) || 'pendiente';
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
  const token = await user.getIdToken();
  const response = await fetch('/api/admin-order-mutation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
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
  if (!modalState) return;
  assertSuperAdmin();
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
      await window.TintinInventoryIntegrity.updateEditedOrder(orderId, patch);
      toast(`Pedido ${patch.orderNumber || orderNumberOf(modalState.baseOrder)} actualizado.`);
    }
    closeModal_();
  } catch (error) {
    console.error('[TINPED] guardar:', error);
    toast(error?.message || 'No se pudo guardar el pedido.', 6500);
  } finally {
    button.disabled = false;
    button.textContent = old;
  }
}

function closeModal_() {
  const overlay = document.getElementById('tinped-crud-overlay');
  if (overlay) overlay.style.display = 'none';
  modalState = null;
}

async function openManualOrder() {
  assertSuperAdmin();
  await loadCatalog_();
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
}

async function openAdvancedOrderEditor(orderId) {
  assertSuperAdmin();
  const safeId = clean(orderId, 220);
  const [orderSnap] = await Promise.all([getDoc(doc(db, ACTIVE_COLLECTION, safeId)), loadCatalog_()]);
  if (!orderSnap.exists()) throw new Error('El pedido ya no existe.');
  const order = { id: safeId, ...orderSnap.data() };
  modalState = { mode: 'edit', orderId: safeId, baseOrder: order, items: Array.isArray(order.items) ? order.items.map(item => ({ ...item })) : [] };
  const overlay = ensureModal_();
  formEl_('tinped-modal-title').textContent = `CRUD completo · ${orderNumberOf(order)}`;
  formEl_('tinped-modal-subtitle').textContent = `ID técnico: ${safeId}`;
  const codeInput = formEl_('tinped-code');
  codeInput.readOnly = false;
  codeInput.removeAttribute('aria-readonly');
  fillModal_(order);
  renderPicker_();
  renderItems_();
  overlay.style.display = 'block';
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