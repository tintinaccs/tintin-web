import { normalizeAdminSearch, renderAdminSearchMarkup } from './datos/busqueda-admin.mjs?v=tintin-20261028-search-admin-1';
import { wristCategory, unifyWristCollections } from '../core/store/categorias-pulseras.mjs?v=tintin-20261014-pulseras-2';
import { productFingerprint } from './products/maestro-productos-core.mjs?v=tintin-20261024-editor-v2-4';
import { variantInventoryEntries, firstAvailableVariant } from '../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';
import { productVariantImage } from '../components/images/foto-variante.mjs?v=tintin-20261023-variant-engine-v2-2';
import { ordersForView, testOrderNumber, orderDisplayCode } from '../orders/pedidos-prueba.mjs?v=tintin-20261020-orders-clean-2';
import { openProductBulkEditor, openProductOrderLink, closeProductMasterDialogs } from './products/maestro-productos-interfaz.js?v=tintin-20261024-editor-v2-4-editor-search-20261028-2';
import { installProductInterface, syncProductSurfaces, visibleProductEditor } from './products/interfaz-productos-adaptable.js?v=tintin-20261030-home-history-5';
import { renderOrderBoard, deliveryLabel } from './orders/tablero-pedidos-vista.mjs?v=tintin-20261027-global-fluidez-3';
import { allowedOrderStatuses, orderStatusLabel, nextOrderStatus, shippingMethod, orderStage } from '../orders/ciclo-pedido.mjs?v=tintin-20261012-orders-board-1';
import { authenticatedFetch } from '../core/auth/cliente-api-autenticado.js?v=tintin-20261022-avatar-inicial-1';
import {productAdminState,productIsPublished} from './products/estado-administrativo-producto.mjs?v=tintin-20261026-editor-workspace-1';
import {readProductEditorResponse} from './products/respuesta-editor-producto.mjs?v=tintin-20261027-editor-ux-1';
import { createAdminPagedSource } from './datos/fuente-paginada-admin.mjs?v=tintin-20261016-admin-live-1';
/* ========================================================================
   TINTIN — Productos, Colecciones y Pedidos
   Capa de experiencia operativa inspirada en Shopify y adaptada al modelo
   real de Tintin. No sustituye los contratos de negocio existentes:
   - Crear/editar productos sigue usando prodNuevo/prodEditar/prodGuardar.
   - Colecciones siguen usando collNueva/collEditar/collGuardar y category.
   - Pedidos siguen usando openOrderEdit/updateOrderStatus/updatePayStatus y
     TintinInventoryIntegrity para conservar stock, auditoría y permisos.

   Lo que sí reemplaza es la superficie de LISTADO/consulta de esos 3 módulos:
   vistas, filtros, selección, panel lateral, búsqueda y navegación rápida.
   ======================================================================== */

import { auth, db } from '../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { waitForAdminAppCheck } from './auth/app-check-admin.js?v=tintin-20261017-domain-cutover-1';
import { subscribeAuthState } from '../core/auth/coordinador-sesion.js?v=tintin-20261022-avatar-inicial-1';
import { recordAuthDiagnostic } from '../core/auth/diagnostico-sesion.js?v=tintin-20261012-auth-privacy-1-diagnostico-sesion-js';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter, where
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { can, getUserRole } from '../core/auth/roles.js?v=tintin-20261017-domain-cutover-1';
import { canDo, loadRolePermissions } from '../core/auth/permisos-roles.js?v=tintin-20261022-avatar-inicial-1';
import { normalizeCollectionDoc } from '../pages/collections/estado-colecciones.js?v=tintin-20261030-home-history-5';
import { sanitizeImageUrl } from '../components/images/utilidades-imagenes.js?v=tintin-20261030-home-history-5';

const VERSION = 'tintin-20261028-guided-editor-3';
const CSS_HREF = `css/admin/shopify-commerce-admin.css?v=${VERSION}`;
const ADMIN_PAGE_SIZE = 30;
const MAX_BULK_SELECTION = 30;
const ORDER_PAGE_SIZE = ADMIN_PAGE_SIZE;

const ORDER_STATUS_LABELS = {
  historico: 'Venta histórica',
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'En preparación', listo: 'Listo', devuelto: 'Devuelto', incidencia: 'Con incidencia',
  listo_retiro: 'Listo para retirar',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
  enviado: 'En camino'
};
const ORDER_STATUS_VALUES = ['pendiente', 'confirmado', 'preparando', 'listo_retiro', 'en_camino', 'entregado', 'cancelado', 'rechazado'];
const PAY_STATUS_LABELS = {
  'señado': 'Parcialmente pagado', parcial: 'Parcialmente pagado',
  sin_registrar: 'Pago no registrado',
  pendiente: 'Pago pendiente',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
  reembolsado: 'Reembolsado',
  error: 'Error'
};
const PAY_STATUS_VALUES = ['pendiente', 'pagado', 'rechazado', 'cancelado', 'reembolsado'];

const state = {
  user: null,
  role: 'client',
  ready: false,
  productsReady: false,
  collectionsReady: false,
  ordersReady: false,
  productsError: '',
  collectionsError: '',
  trashReady: false,
  products: [],
  cardVariants: new Map(),
  cardDrafts: new Map(),
  collections: [],
  orders: [],
  trashOrders: [],
  ordersCursor: null,
  ordersHasMore: false,
  ordersLoadingMore: false,
  productsError: '',
  collectionsError: '',
  ordersError: '',
  productTab: 'all',
  collectionTab: 'all',
  orderTab: 'all', orderStage: 'new', orderDelivery: '', orderVisible: {}, orderBusyIds: new Set(), orderSound: false, includeTestOrders: false, orderHistory: new Map(), orderContacts: new Map(),
  productView: 'grid',
  productFiltersOpen: false,
  productBulkOpen: false,
  productSearch: '',
  collectionSearch: '',
  orderSearch: '',
  productCategory: '',
  productStock: '',
  productSort: 'name-asc',
  collectionVisibility: '',
  collectionSort: 'order-asc',
  orderStatus: '',
  orderPay: '',
  orderSort: 'date-desc',
  productPage: 0,
  collectionPage: 0,
  orderPage: 0,
  productSelected: new Set(),
  collectionSelected: new Set(),
  orderSelected: new Set(),
  drawer: null,
  busy: false,
  unsubscribers: [],
  trashUnsubscribe: null
};

let commerceAuthRecoveryAttempted = false;
let commerceAuthRecoveryPromise = null;

function listenerErrorCode(error) {
  return String(error?.code || error?.name || 'unknown').replace(/^firestore\//, '').toLowerCase();
}

function rangeLabel(page, noun, unavailable = false) {
  if (unavailable && page.total === 0) return 'No disponible';
  if (page.total === 0) return '0 resultados';
  return `Mostrando ${page.page * ADMIN_PAGE_SIZE + 1}–${page.page * ADMIN_PAGE_SIZE + page.items.length} de ${page.total} ${noun}`;
}

function ensureCss() {
  if (document.querySelector(`link[href*="shopify-commerce-admin.css"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  document.head.appendChild(link);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function normalizeText(value) {
  return normalizeAdminSearch(value);
}

function safeImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return sanitizeImageUrl(raw) || '';
  } catch {
    try {
      const url = new URL(raw, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }
}

function productImage(product) {
  const candidates = [
    product?.imageUrl,
    product?.image,
    product?.thumbnail,
    Array.isArray(product?.images) ? product.images[0] : '',
    Array.isArray(product?.media) ? product.media[0]?.url : ''
  ];
  for (const candidate of candidates) {
    const url = safeImage(typeof candidate === 'string' ? candidate : candidate?.url);
    if (url) return url;
  }
  return '';
}

function itemImage(item) {
  return safeImage(item?.image || item?.imageUrl || item?.thumbnail || '');
}

function thumbHtml(url, alt = '') {
  const safe = safeImage(url);
  return `<span class="tt-commerce-thumb">${safe ? `<img src="${esc(safe)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : 'Sin foto'}</span>`;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('es-PY')} Gs`;
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = timestampMillis(value);
  if (!ms) return '—';
  return new Intl.DateTimeFormat('es-PY', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(ms));
}

function toast(message, duration = 3300) {
  if (typeof window.toast === 'function') {
    window.toast(message, duration);
    return;
  }
  const el = document.getElementById('adm-toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._ttCommerceTimer);
  el._ttCommerceTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function perm(moduleKey, actionKey, basePermission) {
  if (state.role === 'superadmin') return true;
  return (!basePermission || can(state.role, basePermission)) && canDo(state.role, moduleKey, actionKey);
}

function button(label, action, { primary = false, danger = false, disabled = false, extra = '' } = {}) {
  return `<button type="button" class="tt-commerce-btn${primary ? ' primary' : ''}${danger ? ' danger' : ''}" data-action="${esc(action)}" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
}

function cardInventory(product) {
  try { return variantInventoryEntries(product); } catch { return []; }
}
function cardVariant(product) {
  const entries = cardInventory(product);
  if (!entries?.length) return '';
  const selected = state.cardVariants.get(product._docId);
  return entries.some(entry => entry.variant === selected) ? selected : firstAvailableVariant(product) || entries[0].variant;
}
function productCardControls(product, status) {
  const id = product._docId, variant = cardVariant(product), entries = cardInventory(product);
  const quantity = entries?.find(entry => entry.variant === variant)?.stock ?? product.stock;
  const draft = state.cardDrafts.get(id + '/' + variant);
  const cardStatus = quantity != null && Number(quantity) === 0 ? {cls:'error',label:variant?'Variante agotada':'Agotado'} : status;
  const disabled = state.busy || !perm('productos', 'editar', 'editProducts');
  const colorKey = window.TintinProductMedia?.colorKey(product);
  let options = `<div class="tt-card-variants${entries?.length ? '' : ' tt-card-variants-empty'}" ${entries?.length ? `role="group" aria-label="Elegir variante de ${esc(product.name)}"` : 'aria-hidden="true"'}>${(entries || []).map(entry => {
    const metadata = colorKey && window.TintinProductMedia?.mediaRows(product).find(row => String(row[colorKey] || '').trim().toLocaleLowerCase('es') === entry.variant.toLocaleLowerCase('es'));
    const color = colorKey && window.TintinProductColors?.swatch(entry.variant, metadata || {});
    const dot = color ? `<span class="tt-card-swatch" style="background:${esc(color)}" aria-hidden="true"></span>` : '';
    return `<button type="button" data-action="product-card-variant" data-id="${esc(id)}" data-variant="${esc(entry.variant)}" aria-pressed="${entry.variant===variant}" class="${entry.stock===0?'is-out':''}">${dot}<span>${esc(entry.variant)}${entry.stock===0?' · agotado':''}</span></button>`;
  }).join('')}</div>`;
  if (entries?.length > 4) options = `<div class="tt-card-variants"><select class="tt-card-variant-select" data-card-variant="${esc(id)}" aria-label="Elegir variante de ${esc(product.name)}">${entries.map(entry => `<option value="${esc(entry.variant)}" ${entry.variant===variant?'selected':''}>${esc(entry.variant)}${entry.stock===0?' · agotado':''}</option>`).join('')}</select></div>`;
  const visibility = `<label class="tt-card-visibility ${product.active===false?'is-inactive':'is-active'}"><span>Visibilidad</span><select data-card-active="${esc(id)}" aria-label="Estado de ${esc(product.name)}" ${state.busy || !perm('productos','activarDesactivar','editProducts')?'disabled':''}><option value="true" ${product.active!==false?'selected':''}>Activo</option><option value="false" ${product.active===false?'selected':''}>Inactivo</option></select></label>`;
  const stock = `<div class="tt-card-stock-field"><span class="tt-card-stock-label">${variant ? `Stock · ${esc(variant)}` : 'Inventario'}</span><div class="tt-card-stock-control"><input type="number" min="0" max="1000000" step="1" inputmode="numeric" data-card-stock="${esc(id)}" data-variant="${esc(variant)}" value="${esc(draft?.value ?? quantity ?? '')}" placeholder="Sin límite" aria-label="Stock de ${esc(product.name)}${variant?' · '+esc(variant):''}" ${disabled || entries?.length===0?'disabled':''}><button type="button" class="tt-commerce-btn" data-action="product-card-save" data-id="${esc(id)}" data-variant="${esc(variant)}" ${disabled || entries?.length===0?'disabled':''}>Guardar</button></div></div>`;
  return {options, status:`<span class="tt-commerce-badge ${cardStatus.cls}">${cardStatus.label}</span>`, stock:`<div class="tt-card-edit-grid">${visibility}${stock}</div><button type="button" class="tt-card-discard" data-action="product-card-cancel" data-id="${esc(id)}" data-variant="${esc(variant)}" ${draft?'':'hidden'}>Descartar borrador</button><small class="tt-card-total">Total: <span class="tt-commerce-stock">${product.stock == null ? 'Sin límite' : esc(product.stock)}</span>${product.stock == null ? '' : ' unidades'}</small>${productVariantsCount(product)>1 && entries===null?'<small>Stock total. Distribuí por opción desde Editar producto.</small>':''}`};
}
async function saveProductCard(product, field, value, variant='') {
  if (state.busy || !product || !state.user?.uid) return;
  const ownerUid = state.user.uid;
  const draftKey = product._docId + '/' + variant;
  const expected = field==='stock' ? state.cardDrafts.get(draftKey)?.expected || productFingerprint(product) : productFingerprint(product);
  if (typeof window.TintinProductAdmin?.updateCard !== 'function') { toast('El guardado todavía está cargando. Reintentá.'); renderProducts(); return; }
  setBusy(true);
  try {
    const result = await window.TintinProductAdmin.updateCard({id:product._docId,field,value,variant,expected});
    if (state.user?.uid===ownerUid && result?.status==='green') {
      if(field==='stock')state.cardDrafts.delete(draftKey);
      const fingerprint=result.value?.fingerprint;
      if(fingerprint)for(const [key,draft] of state.cardDrafts)if(key.startsWith(product._docId+'/') && draft.expected===expected)draft.expected=fingerprint;
    }
  } catch (error) { if(state.user?.uid===ownerUid)toast(error.message); }
  finally { setBusy(false); if(state.user?.uid===ownerUid){renderProducts();renderCollections();} }
}

async function saveCollectionVisibility(target) {
  if (state.busy || !state.user?.uid || !perm('colecciones','activarDesactivar','manageContent')) return;
  const collection=state.collections.find(item=>item.slug===target.dataset.collectionVisible);
  if (!collection) return;
  const controller=window.TintinProductAdmin;
  if(typeof controller?.updateCollectionVisibility !== 'function'){toast('El guardado todavía está cargando. Reintentá.');renderCollections();return;}
  const ownerUid=state.user?.uid;
  setBusy(true);
  try {await controller.updateCollectionVisibility({id:collection.sourceSlugs?.includes(collection.slug) ? collection.slug : collection.sourceSlugs?.[0] || collection.slug,visible:target.value==='true',expectedVisible:collection.visible!==false});}
  catch(error){if(state.user?.uid===ownerUid)toast(error.message);}
  finally{setBusy(false);if(state.user?.uid===ownerUid){renderProducts();renderCollections();document.querySelector(`[data-collection-visible="${CSS.escape(collection.slug)}"]`)?.focus({preventScroll:true});}}
}

function productStatus(product) {
  const editorial=productAdminState(product);
  if(editorial!=='active')return {key:editorial,label:{inactive:'Inactivo (histórico)',draft:'Borrador',archived:'Archivado'}[editorial],cls:'warning'};
  if (product?.stock !== null && product?.stock !== undefined && Number(product.stock) <= 0) {
    return { key: 'soldout', label: 'Agotado', cls: 'error' };
  }
  return { key: 'active', label: 'Activo', cls: 'success' };
}

function payStatus(order) {
  return String(order?.paymentStatus || order?.payment?.status || 'pendiente');
}

function orderStatus(order) {
  return String(order?.status || 'pendiente');
}

function orderCustomer(order) {
  return {
    name: order?.userName || order?.customer?.name || order?.name || 'Sin nombre',
    email: order?.userEmail || order?.customer?.email || order?.email || '',
    phone: order?.userPhone || order?.customer?.phone || order?.phone || ''
  };
}

function orderShipping(order) {
  const shipping = order?.shipping || {};
  return {
    method: shipping.method || order?.shippingMethod || '—',
    city: shipping.city || order?.city || '—',
    address: shipping.address || order?.address || '—',
    reference: shipping.reference || order?.reference || '',
    agency: shipping.agency || order?.agency || '',
    mode: shipping.mode || order?.encomiendaMode || ''
  };
}

function orderItems(order) {
  return Array.isArray(order?.items) ? order.items.filter(Boolean) : [];
}

function orderDisplayId(order) {
  return orderDisplayCode(order);
}

function productVariantsCount(product) {
  if (Array.isArray(product?.variants)) return product.variants.length;
  if (product?.variants && typeof product.variants === 'object') return Object.keys(product.variants).length;
  return 0;
}

function collectionProductCount(slug) {
  return state.products.filter(product => wristCategory(product?.category || product?.cat || '') === wristCategory(slug || '')).length;
}

function productTabCounts() {
  return {
    all: state.products.length,
    active: state.products.filter(productIsPublished).length,
    draft: state.products.filter(p=>productAdminState(p)==='draft').length,
    archived: state.products.filter(p=>productAdminState(p)==='archived').length,
    inactive: state.products.filter(p=>productAdminState(p)==='inactive').length,
    soldout: state.products.filter(p => productIsPublished(p) && p?.stock != null && Number(p.stock) <= 0).length,
    sale: state.products.filter(p => p?.oferta === true || (Number(p?.priceBefore) > Number(p?.price) && Number(p?.price) >= 0)).length,
    featured: state.products.filter(p => p?.destacado === true).length,
    low:state.products.filter(p=>productIsPublished(p) && p.stock!=null && Number(p.stock)>0 && Number(p.stock)<=5).length,
    missingphoto:state.products.filter(p=>!productImage(p)).length,
    unclassified:state.products.filter(p=>!state.collections.some(c=>wristCategory(c.slug)===wristCategory(p.category || p.cat))).length
  };
}

function orderTabCounts() {
  return { all: state.orders.length, unpaid: state.orders.filter(o => payStatus(o) !== 'pagado').length, unfulfilled: state.orders.filter(o => !o.localEntryId && !['entregado', 'cancelado', 'rechazado'].includes(orderStatus(o))).length, delivered: state.orders.filter(o => orderStatus(o) === 'entregado').length, canceled: state.orders.filter(o => ['cancelado', 'rechazado'].includes(orderStatus(o))).length, refunded: state.orders.filter(o => payStatus(o) === 'reembolsado').length, deleted: ordersForView(state.trashOrders,state.includeTestOrders).length };
}

function collectionTabCounts() {
  return {
    all: state.collections.length,
    visible: state.collections.filter(c => c.visible !== false).length,
    hidden: state.collections.filter(c => c.visible === false).length
  };
}

function filteredProducts() {
  let list = [...state.products];
  const q = normalizeText(state.productSearch);
  if (q) {
    list = list.filter(p => [p?.name, p?.category, p?._docId, p?.sku,p?.collection,...(Array.isArray(p?.tags)?p.tags:[])].some(v => normalizeText(v).includes(q)));
  }
  if (['active','inactive','draft','archived'].includes(state.productTab)) list = list.filter(p => productAdminState(p)===state.productTab);
  if (state.productTab === 'soldout') list = list.filter(p => productIsPublished(p) && p?.stock != null && Number(p.stock) <= 0);
  if (state.productTab === 'sale') list = list.filter(p => p?.oferta === true || Number(p?.priceBefore) > Number(p?.price));
  if(state.productTab==='low')list=list.filter(p=>productIsPublished(p) && p.stock!=null && Number(p.stock)>0 && Number(p.stock)<=5);
  if(state.productTab==='missingphoto')list=list.filter(p=>!productImage(p));
  if(state.productTab==='unclassified')list=list.filter(p=>!state.collections.some(c=>wristCategory(c.slug)===wristCategory(p.category || p.cat)));
  if (state.productTab === 'featured') list = list.filter(p => p?.destacado === true);
  if (state.productCategory) list = list.filter(p => wristCategory(p?.category || p?.cat || '') === wristCategory(state.productCategory));
  if (state.productStock === 'in') list = list.filter(p => p?.stock == null || Number(p.stock) > 0);
  if (state.productStock === 'out') list = list.filter(p => p?.stock != null && Number(p.stock) <= 0);
  if (state.productStock === 'unlimited') list = list.filter(p => p?.stock == null);

  const [field, direction] = state.productSort.split('-');
  const factor = direction === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    if (field === 'price') return (Number(a?.price || 0) - Number(b?.price || 0)) * factor;
    if (field === 'stock') {
      const av = a?.stock == null ? Number.MAX_SAFE_INTEGER : Number(a.stock);
      const bv = b?.stock == null ? Number.MAX_SAFE_INTEGER : Number(b.stock);
      return (av - bv) * factor;
    }
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity: 'base' }) * factor;
  });
  return list;
}

function filteredCollections() {
  let list = [...state.collections];
  const q = normalizeText(state.collectionSearch);
  if (q) list = list.filter(c => [c?.name, c?.slug, c?.description].some(v => normalizeText(v).includes(q)));
  if (state.collectionTab === 'visible') list = list.filter(c => c.visible !== false);
  if (state.collectionTab === 'hidden') list = list.filter(c => c.visible === false);
  if (state.collectionVisibility === 'visible') list = list.filter(c => c.visible !== false);
  if (state.collectionVisibility === 'hidden') list = list.filter(c => c.visible === false);

  const [field, direction] = state.collectionSort.split('-');
  const factor = direction === 'desc' ? -1 : 1;
  list.sort((a, b) => {
    if (field === 'products') return (collectionProductCount(a.slug) - collectionProductCount(b.slug)) * factor;
    if (field === 'name') return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity: 'base' }) * factor;
    return ((Number(a?.order) || 0) - (Number(b?.order) || 0)) * factor;
  });
  return list;
}

function filteredOrders() {
  let list = ordersForView(state.orderTab === 'deleted' ? state.trashOrders : state.orders, state.includeTestOrders);
  const q = normalizeText(state.orderSearch);
  if (q) list = list.filter(order => { const customer = orderCustomer(order); const items = orderItems(order).map(item => item?.name || item?.title || '').join(' '); return [orderDisplayId(order), order?.id, customer.name, customer.email, customer.phone, items].some(v => normalizeText(v).includes(q)); });
  if (state.orderTab === 'unpaid') list = list.filter(o => payStatus(o) !== 'pagado');
  if (state.orderTab === 'unfulfilled') list = list.filter(o => !['entregado', 'cancelado', 'rechazado'].includes(orderStatus(o)));
  if (state.orderTab === 'delivered') list = list.filter(o => orderStatus(o) === 'entregado');
  if (state.orderTab === 'canceled') list = list.filter(o => ['cancelado', 'rechazado'].includes(orderStatus(o)));
  if (state.orderTab === 'refunded') list = list.filter(o => payStatus(o) === 'reembolsado');
  if (state.orderDelivery) list = list.filter(o => shippingMethod(o) === state.orderDelivery);
  if (state.orderTab === 'history') list = list.filter(o => Boolean(o.localEntryId));
  if (state.orderStatus) list = list.filter(o => orderStatus(o) === state.orderStatus);
  if (state.orderPay) list = list.filter(o => payStatus(o) === state.orderPay);
  const [, direction] = state.orderSort.split('-'); const factor = direction === 'asc' ? 1 : -1;
  list.sort((a, b) => (timestampMillis(a?.createdAt || a?.trashMeta?.trashedAt) - timestampMillis(b?.createdAt || b?.trashMeta?.trashedAt)) * factor);
  return list;
}

function orderMetrics() {
  const today = new Date();
  const isToday = order => {
    const ms = timestampMillis(order?.createdAt);
    if (!ms) return false;
    const date = new Date(ms);
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };
  const todayOrders = state.orders.filter(isToday);
  const active = state.orders.filter(order => !['cancelado', 'rechazado'].includes(orderStatus(order)));
  const revenue = todayOrders.reduce((sum, order) => sum + (Number(order?.total) || 0), 0);
  const pending = active.filter(order => payStatus(order) !== 'pagado').length;
  const unfulfilled = active.filter(order => !order.localEntryId && !['entregado'].includes(orderStatus(order))).length;
  const delivered = state.orders.filter(order => orderStatus(order) === 'entregado').length;
  const items = todayOrders.reduce((sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item?.qty ?? item?.quantity ?? 1), 0), 0);
  return { today: todayOrders.length, revenue, pending, unfulfilled, delivered, items };
}

function tabButton(module, key, label, count, activeKey) {
  return `<button type="button" class="tt-commerce-tab${activeKey === key ? ' active' : ''}" data-tab-module="${module}" data-tab="${key}">${esc(label)}<span class="n">${count}</span></button>`;
}

function pageSlice(list, page) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, Number(page) || 0), pages - 1);
  return {
    items: list.slice(safePage * ADMIN_PAGE_SIZE, (safePage + 1) * ADMIN_PAGE_SIZE),
    page: safePage,
    pages,
    total,
  };
}

function pageControls(actionPrefix, page, pages, { hasMore = false, loading = false } = {}) {
  const canNext = page < pages - 1 || hasMore;
  if (pages <= 1 && !hasMore) return '';
  return `<div class="tt-commerce-pagination" aria-label="Paginación">
    <button type="button" class="tt-commerce-btn" data-action="${actionPrefix}-prev" ${page <= 0 ? 'disabled' : ''}>Anterior</button>
    <span>Página ${page + 1}${hasMore && page >= pages - 1 ? '+' : ` de ${pages}`}</span>
    <button type="button" class="tt-commerce-btn" data-action="${actionPrefix}-next" ${!canNext || loading ? 'disabled' : ''}>${loading ? 'Cargando…' : 'Siguiente'}</button>
  </div>`;
}

function addToLimitedSelection(set, id, checked) {
  if (!checked) {
    set.delete(id);
    return true;
  }
  if (set.has(id)) return true;
  if (set.size >= MAX_BULK_SELECTION) {
    toast(`Solo se pueden seleccionar ${MAX_BULK_SELECTION} elementos por vez.`);
    return false;
  }
  set.add(id);
  return true;
}

function selectPageOnly(set, ids, checked) {
  if (!checked) {
    ids.forEach(id => set.delete(id));
    return;
  }
  const missing = ids.filter(id => !set.has(id));
  const available = Math.max(0, MAX_BULK_SELECTION - set.size);
  missing.slice(0, available).forEach(id => set.add(id));
  if (missing.length > available) toast(`La selección está limitada a ${MAX_BULK_SELECTION} elementos.`);
}

let privateWorkOwner='',privateWorkRole='',privateWorks=[],privateWorkError='',privateWorkLoading=false,privateWorkLimited=false,privateWorkNext='',privateWorkGeneration=0;
async function loadPrivateProductWorks(force=false,append=false) {
  const uid=state.user?.uid || '',role=state.role;
  if(!uid || !['admin','superadmin'].includes(role)){
    if(privateWorkOwner){++privateWorkGeneration;privateWorkOwner='';privateWorkRole='';privateWorks=[];privateWorkNext='';privateWorkError='';privateWorkLoading=false;privateWorkLimited=false;}
    return;
  }
  if(append && (privateWorkOwner!==uid || privateWorkRole!==role || !privateWorkNext || privateWorkLoading))return;
  if(!force && !append && privateWorkOwner===uid && privateWorkRole===role)return;
  const pageToken=append?privateWorkNext:'';
  const generation=++privateWorkGeneration;privateWorkOwner=uid;privateWorkRole=role;privateWorkLoading=true;privateWorkError='';
  if(!append){privateWorks=[];privateWorkLimited=false;privateWorkNext='';}
  try{
    const response=await authenticatedFetch('/api/admin-order-mutation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'listProductWork',...(pageToken?{pageToken}:{})})});
    const payload=await readProductEditorResponse(response);
    if(state.user?.uid===uid && state.role===role && generation===privateWorkGeneration){
      privateWorks=[...new Map([...(append?privateWorks:[]),...(payload.result.items || [])].map(work=>[work.key,work])).values()];
      privateWorkNext=payload.result.nextPageToken || '';privateWorkLimited=payload.result.limited===true;
    }
  }catch(error){if(state.user?.uid===uid && state.role===role && generation===privateWorkGeneration)privateWorkError=error.message;}
  finally{if(generation===privateWorkGeneration){privateWorkLoading=false;if(document.getElementById('section-productos')?.classList.contains('tt-commerce-mounted'))renderProducts();}}
}
window.addEventListener('tintin:product-work-saved',()=>void loadPrivateProductWorks(true));
function renderProducts() {
  const root = document.getElementById('tt-commerce-products');
  if (!root) return;
  const activeControl=document.activeElement;
  const focusAttribute=root.contains(activeControl) ? ['data-card-stock','data-card-active','data-card-category','data-card-variant','data-product-metric','data-filter','data-select-product','data-check-all','data-action','data-tab'].find(attribute=>activeControl.hasAttribute(attribute)) : null;
  const focusSelector=focusAttribute ? `[${focusAttribute}="${CSS.escape(activeControl.getAttribute(focusAttribute))}"]` + ['data-id','data-variant'].filter(attribute=>activeControl.hasAttribute(attribute)).map(attribute=>`[${attribute}="${CSS.escape(activeControl.getAttribute(attribute))}"]`).join('') : null;
  const caret=focusAttribute && typeof activeControl.selectionStart==='number' ? [activeControl.selectionStart,activeControl.selectionEnd] : null;
  root.dataset.view=state.productView;root.dataset.filtersOpen=String(state.productFiltersOpen);root.dataset.bulkOpen=String(state.productBulkOpen);
  void loadPrivateProductWorks();
  const counts = productTabCounts();
  const ownerWorks=privateWorkOwner===state.user?.uid?privateWorks:[];
  const privatePanel=state.productTab==='draft'?`<section aria-label="Progreso privado"><h3>Borradores de esta cuenta</h3><p>Ediciones privadas recuperables. La tienda conserva la última versión publicada.</p>${privateWorkOwner===state.user?.uid && privateWorkLimited && !privateWorkNext?'<p role="status">La lista de borradores está limitada. Puede haber más progreso guardado que no aparece aquí. No se eliminó; revisá el producto existente antes de crear otra copia.</p>':''}${privateWorkLoading?'<p role="status">Buscando progreso guardado…</p>':''}${privateWorkError?`<p role="alert">${esc(privateWorkError)}</p><button class="tt-commerce-btn" data-action="work-retry">Reintentar</button>`:''}<div class="tt-private-work-list">${ownerWorks.map(work=>`<button class="tt-commerce-btn" data-action="work-continue" data-key="${esc(work.key)}" data-product-id="${esc(work.productId || '')}"><strong>${esc(work.name)}</strong><br>Continuar borrador · ${work.productId?'edición pendiente':'producto nuevo'}${work.updatedAt && Number.isFinite(Date.parse(work.updatedAt))?`<br>Última modificación: ${esc(new Date(work.updatedAt).toLocaleString('es-PY'))}`:''}</button>`).join('')}</div>${privateWorkNext?`<button class="tt-commerce-btn" data-action="work-more" ${privateWorkLoading?'disabled':''}>${privateWorkLoading?'Cargando…':'Cargar más borradores'}</button>`:''}${!privateWorkLoading && !privateWorkError && !ownerWorks.length && !privateWorkNext?'<p>No hay progreso privado pendiente.</p>':''}</section>`:`${ownerWorks.length?`<p><button class="tt-commerce-btn" data-action="work-show">Borradores privados (${ownerWorks.length})</button></p>`:''}`;
  const list = filteredProducts();
  const page = pageSlice(list, state.productPage);
  state.productPage = page.page;
  const selectedVisible = page.items.filter(p => state.productSelected.has(p._docId)).length;
  const allVisibleSelected = page.items.length > 0 && selectedVisible === page.items.length;
  const canCreate = perm('productos', 'crear', 'addProducts');
  const canEdit = perm('productos', 'editar', 'editProducts');
  const canToggle = perm('productos', 'activarDesactivar', 'editProducts');
  const canDelete = state.role==='superadmin' && perm('productos', 'eliminar', 'deleteProducts');
  const canBulk = perm('productos', 'accionesMasivas', 'editProducts');
  const canExport = perm('productos', 'exportar', 'editProducts') || state.role === 'viewer';
  const filterCount=Number(Boolean(state.productCategory))+Number(Boolean(state.productStock))+Number(state.productTab!=='all');
  const hiddenSelected=state.productSelected.size-list.filter(product=>state.productSelected.has(product._docId)).length;
  const productsUnavailable = Boolean(state.productsError && !state.products.length);
  const productsWarning = state.productsError
    ? `<div class="tt-commerce-error" role="alert">${esc(state.productsError)}${state.products.length ? ' Se muestran los últimos datos confirmados.' : ''} <button type="button" class="tt-commerce-btn" data-action="products-retry">Reintentar</button></div>`
    : '';

  renderAdminSearchMarkup(root, `
    <div class="tt-commerce-pagehead">
      <div class="tt-commerce-titlegroup">
        <h1 class="tt-commerce-title">Productos <span class="tt-commerce-count">${state.productsError ? "—" : state.products.length}</span></h1>
        <div class="tt-commerce-subtitle">Catálogo conectado en tiempo real con la tienda.</div>
      </div>
      <div class="tt-commerce-actions tt-product-page-actions">
        ${canExport ? button('Exportar', 'products-export') : ''}
        ${state.role === 'superadmin' ? button('Importar', 'products-import') : ''}
        ${canCreate ? button('Agregar producto', 'product-new', { primary: true }) : ''}
      </div>
    </div>
    <div class="tt-product-metrics" aria-label="Indicadores de catálogo">${[['all','Total'],['active','Activos'],['draft','Borradores'],['inactive','Inactivos históricos'],['archived','Archivados'],['soldout','Agotados'],['low','Stock bajo (1–5)'],['missingphoto','Sin foto'],['unclassified','Sin colección válida']].map(([key,label])=>`<button type="button" data-action="products-metric" data-product-metric="${key}" aria-pressed="${state.productTab===key}"><strong>${state.productsReady && !state.productsError?counts[key]:'—'}</strong><span>${label}</span></button>`).join('')}</div>
    <div class="tt-commerce-card">
      <div class="tt-commerce-tabs">
        ${tabButton('products', 'all', 'Todos', counts.all, state.productTab)}
        ${tabButton('products', 'active', 'Activos', counts.active, state.productTab)}
        ${tabButton('products', 'draft', 'Borradores', counts.draft, state.productTab)}
        ${tabButton('products', 'inactive', 'Inactivos', counts.inactive, state.productTab)}
        ${tabButton('products', 'archived', 'Archivados', counts.archived, state.productTab)}
        ${tabButton('products', 'soldout', 'Agotados', counts.soldout, state.productTab)}
        ${tabButton('products', 'sale', 'En oferta', counts.sale, state.productTab)}
        ${tabButton('products', 'featured', 'Destacados', counts.featured, state.productTab)}
      </div>
      <div class="tt-product-search-row">
        <label class="tt-commerce-search"><input class="tt-commerce-input" data-filter="product-search" type="search" value="${esc(state.productSearch)}" placeholder="Nombre, SKU o etiquetas" aria-label="Buscar productos por nombre, SKU, colección o etiqueta"></label>
        <button type="button" class="tt-commerce-btn tt-product-filters-toggle" data-action="products-filters" aria-expanded="${state.productFiltersOpen}" aria-controls="tt-product-filter-panel">Filtros${filterCount ? ` (${filterCount})` : ''}</button>
        <div class="tt-product-views" role="group" aria-label="Vista de productos">${['grid','list'].map(view=>`<button type="button" class="tt-commerce-btn" data-action="products-view-${view}" aria-pressed="${state.productView===view}">${view==='grid'?'Mosaico':'Lista'}</button>`).join('')}</div>
      </div>
      <div class="tt-commerce-toolbar tt-product-filter-panel" id="tt-product-filter-panel">
        <label class="tt-product-status-filter">Estado<select class="tt-commerce-select" data-filter="product-status" aria-label="Filtrar por estado">${[['all','Todos'],['active','Activos'],['draft','Borradores'],['inactive','Inactivos históricos'],['archived','Archivados'],['soldout','Agotados'],['sale','En oferta'],['featured','Destacados'],['low','Stock bajo (1–5)'],['missingphoto','Sin foto'],['unclassified','Sin colección válida']].map(([value,label])=>`<option value="${value}" ${state.productTab===value?'selected':''}>${label} (${counts[value]})</option>`).join('')}</select></label>
        <label>Colección
        <select class="tt-commerce-select" data-filter="product-category" aria-label="Filtrar por colección">
          <option value="">Todas las colecciones</option>
          ${state.collections.map(c => `<option value="${esc(c.slug)}" ${state.productCategory === c.slug ? 'selected' : ''}>${esc(c.name || c.slug)}</option>`).join('')}
        </select></label>
        <label>Inventario<select class="tt-commerce-select" data-filter="product-stock" aria-label="Filtrar por inventario">
          <option value="">Todo el inventario</option>
          <option value="in" ${state.productStock === 'in' ? 'selected' : ''}>Con stock</option>
          <option value="out" ${state.productStock === 'out' ? 'selected' : ''}>Agotados</option>
          <option value="unlimited" ${state.productStock === 'unlimited' ? 'selected' : ''}>Sin control de stock</option>
        </select></label>
        <label>Ordenar<select class="tt-commerce-select" data-filter="product-sort" aria-label="Ordenar productos">
          <option value="name-asc" ${state.productSort === 'name-asc' ? 'selected' : ''}>Nombre A–Z</option>
          <option value="name-desc" ${state.productSort === 'name-desc' ? 'selected' : ''}>Nombre Z–A</option>
          <option value="price-desc" ${state.productSort === 'price-desc' ? 'selected' : ''}>Precio mayor</option>
          <option value="price-asc" ${state.productSort === 'price-asc' ? 'selected' : ''}>Precio menor</option>
          <option value="stock-desc" ${state.productSort === 'stock-desc' ? 'selected' : ''}>Más stock</option>
          <option value="stock-asc" ${state.productSort === 'stock-asc' ? 'selected' : ''}>Menos stock</option>
        </select></label>
        <button type="button" class="tt-commerce-btn" data-action="products-reset-filters">Limpiar filtros</button>
      </div>
      <p class="tt-product-selection-hint">Marcá las casillas para seleccionar varios. Abrí la foto o el nombre para ver el producto.</p>
      ${privatePanel}
      ${productsWarning}
      ${!state.productsReady ? '<div class="tt-commerce-loading">Cargando productos…</div>' : productsUnavailable ? '' : page.items.length ? `
      <div class="tt-commerce-tablewrap tt-commerce-product-grid-wrap">
        <label class="tt-commerce-product-select-all"><input type="checkbox" data-check-all="products" ${allVisibleSelected ? 'checked' : ''} aria-label="Seleccionar todos los productos visibles"> Seleccionar esta página <span>Hasta ${MAX_BULK_SELECTION} productos por acción</span></label>
        <table class="tt-commerce-table tt-commerce-product-grid" role="table" aria-label="Productos">
          <thead><tr>
            <th class="checkcol">Selección</th>
            <th>Producto</th><th>Estado</th><th>Inventario</th><th>Precio</th><th>Colección</th><th></th>
          </tr></thead>
          <tbody>${page.items.map(product => {
            const status = productStatus(product);
            const controls = productCardControls(product, status);
            const selectedVariant = cardVariant(product);
            const cardImage = selectedVariant ? productVariantImage(product, selectedVariant, productImage(product)) : productImage(product);
            const variants = productVariantsCount(product);
            const selected = state.productSelected.has(product._docId);
            return `<tr data-open="product" data-id="${esc(product._docId)}" data-product-active="${product.active !== false}" class="${selected ? 'is-selected' : ''}">
              <td class="checkcol" data-stop><label class="tt-commerce-product-check"><input type="checkbox" data-select-product="${esc(product._docId)}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${esc(product.name || 'producto')}"></label></td>
              <td class="tt-commerce-product-main"><div class="tt-commerce-productcell">${thumbHtml(cardImage, product.name || 'Producto')}${controls.options}<div class="tt-card-identity"><button type="button" class="tt-commerce-product-open" data-action="drawer-product" data-id="${esc(product._docId)}">${esc(product.name || 'Sin nombre')}</button><div class="tt-commerce-subtext tt-card-code" title="${esc(product.sku || product._docId)}">${variants ? `${variants} variante${variants === 1 ? '' : 's'} · ` : ''}${product.sku?`SKU: ${esc(product.sku)} · `:''}${esc(product._docId)}</div></div></div></td>
              <td class="tt-commerce-product-status">${controls.status}${product.destacado ? '<span class="tt-commerce-badge">Destacado</span>' : ''}${product.oferta || Number(product.priceBefore) > Number(product.price) ? '<span class="tt-commerce-badge">Oferta</span>' : ''}</td>
              <td class="tt-commerce-product-inventory">${controls.stock}</td>
              <td class="tt-commerce-product-price"><span class="tt-commerce-product-label">Precio</span><span class="tt-commerce-money">${formatMoney(product.price)}</span>${Number(product.priceBefore) > Number(product.price) ? `<div class="tt-commerce-subtext"><s>${formatMoney(product.priceBefore)}</s></div>` : ''}</td>
              <td class="tt-commerce-product-collection" data-stop><label class="tt-card-collection"><span>Colección</span><select data-card-category="${esc(product._docId)}" aria-label="Colección de ${esc(product.name)}" ${state.busy || !perm('productos','editar','editProducts') || !state.collectionsReady?'disabled':''}>${!state.collections.some(c=>wristCategory(c.slug)===wristCategory(product.category || product.cat))?`<option value="" selected disabled>${esc(product.category || 'Elegir colección')}</option>`:''}${state.collections.map(c=>`<option value="${esc(c.slug)}" ${wristCategory(c.slug)===wristCategory(product.category || product.cat)?'selected':''}>${esc(c.name || c.slug)}${c.visible===false?' · oculta':''}</option>`).join('')}</select></label></td>
              <td class="tt-commerce-product-menu" data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="product" data-id="${esc(product._docId)}" aria-label="Acciones de ${esc(product.name || 'producto')}">⋯</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : '<div class="tt-commerce-empty">No hay productos que coincidan con esta vista.</div>'}
      <div class="tt-commerce-footer"><span>${rangeLabel(page, 'productos', productsUnavailable)}</span><span>Los cambios se sincronizan automáticamente.</span>${pageControls('products-page', page.page, page.pages)}</div>
      <div class="tt-commerce-bulkbar tt-product-selection" ${state.productSelected.size && (canBulk || canExport || state.role==='superadmin') ? '' : 'hidden'}>
        <span class="tt-commerce-bulkcount" role="status">${state.productSelected.size} seleccionado${state.productSelected.size === 1 ? '' : 's'}${hiddenSelected ? ` · ${hiddenSelected} fuera del filtro` : ''}</span>
        <button type="button" class="tt-commerce-btn tt-product-bulk-toggle" data-action="products-bulk-panel" aria-expanded="${state.productBulkOpen}" aria-controls="tt-product-bulk-options">Acciones</button>
        ${button('Limpiar', 'products-clear-selection')}
        <div class="tt-product-bulk-options" id="tt-product-bulk-options">
          ${canBulk && canEdit ? button('Editar selección','products-bulk-edit') : ''}
          ${state.role==='superadmin' && perm('pedidos','editar','editOrders') ? button('Agregar a una compra','products-link-order') : ''}
          ${canBulk && canToggle ? button('Activar', 'products-bulk-activate') : ''}
          ${canBulk && canToggle ? button('Inactivar', 'products-bulk-deactivate') : ''}
          ${canDelete && canBulk ? button('Eliminar seleccionados', 'products-bulk-delete', { danger: true }) : ''}
          ${canExport ? button('Exportar selección', 'products-export-selected') : ''}
        </div>
      </div>
    </div>`);
  syncProductSurfaces();
  if (state.busy) root.querySelectorAll('button,input,select').forEach(control=>{control.disabled=true;});
  if (focusSelector) {
    const control=root.querySelector(focusSelector);control?.focus({preventScroll:true});
    if (caret && control?.setSelectionRange) control.setSelectionRange(...caret);
  }
}

function renderCollections() {
  const root = document.getElementById('tt-commerce-collections');
  if (!root) return;
  const focusedId=root.contains(document.activeElement) ? document.activeElement.dataset.collectionVisible : null;
  const pageSelectionFocused=root.contains(document.activeElement) && document.activeElement.matches('[data-check-all="collections"]');
  const counts = collectionTabCounts();
  const list = filteredCollections();
  const page = pageSlice(list, state.collectionPage);
  state.collectionPage = page.page;
  const selectedVisible = page.items.filter(c => state.collectionSelected.has(c.slug)).length;
  const allVisibleSelected = page.items.length > 0 && selectedVisible === page.items.length;
  const canCreate = perm('colecciones', 'crear', 'manageContent');
  const canEdit = perm('colecciones', 'editar', 'manageContent');
  const canToggle = perm('colecciones', 'activarDesactivar', 'manageContent');
  const canDelete = perm('colecciones', 'eliminar', 'deleteCollections');
  const canBulk = perm('colecciones', 'accionesMasivas', 'manageContent');
  const collectionsUnavailable = Boolean(state.collectionsError && !state.collections.length);
  const collectionsWarning = state.collectionsError
    ? `<div class="tt-commerce-error" role="alert">${esc(state.collectionsError)}${state.collections.length ? ' Se muestran los últimos datos confirmados.' : ''} <button type="button" class="tt-commerce-btn" data-action="collections-retry">Reintentar</button></div>`
    : '';

  renderAdminSearchMarkup(root, `
    <div class="tt-commerce-pagehead">
      <div class="tt-commerce-titlegroup">
        <h1 class="tt-commerce-title">Colecciones <span class="tt-commerce-count">${state.collectionsError ? "—" : state.collections.length}</span></h1>
        <div class="tt-commerce-subtitle">Agrupación real del catálogo de Tintin. Cada producto conserva su colección principal.</div>
      </div>
      <div class="tt-commerce-actions">${canCreate ? button('Crear colección', 'collection-new', { primary: true }) : ''}</div>
    </div>
    <div class="tt-commerce-card">
      <div class="tt-commerce-tabs">
        ${tabButton('collections', 'all', 'Todas', counts.all, state.collectionTab)}
        ${tabButton('collections', 'visible', 'Visibles', counts.visible, state.collectionTab)}
        ${tabButton('collections', 'hidden', 'Ocultas', counts.hidden, state.collectionTab)}
      </div>
      <div class="tt-commerce-toolbar" style="grid-template-columns:minmax(220px,1fr) minmax(150px,auto) minmax(150px,auto)">
        <label class="tt-commerce-search"><input class="tt-commerce-input" data-filter="collection-search" type="search" value="${esc(state.collectionSearch)}" placeholder="Buscar colecciones"></label>
        <select class="tt-commerce-select" data-filter="collection-visibility" aria-label="Filtrar visibilidad">
          <option value="">Toda visibilidad</option>
          <option value="visible" ${state.collectionVisibility === 'visible' ? 'selected' : ''}>Visibles</option>
          <option value="hidden" ${state.collectionVisibility === 'hidden' ? 'selected' : ''}>Ocultas</option>
        </select>
        <select class="tt-commerce-select" data-filter="collection-sort" aria-label="Ordenar colecciones">
          <option value="order-asc" ${state.collectionSort === 'order-asc' ? 'selected' : ''}>Orden de la tienda</option>
          <option value="name-asc" ${state.collectionSort === 'name-asc' ? 'selected' : ''}>Nombre A–Z</option>
          <option value="name-desc" ${state.collectionSort === 'name-desc' ? 'selected' : ''}>Nombre Z–A</option>
          <option value="products-desc" ${state.collectionSort === 'products-desc' ? 'selected' : ''}>Más productos</option>
          <option value="products-asc" ${state.collectionSort === 'products-asc' ? 'selected' : ''}>Menos productos</option>
        </select>
      </div>
      <div class="tt-commerce-bulkbar" ${state.collectionSelected.size ? '' : 'hidden'}>
        <span class="tt-commerce-bulkcount">${state.collectionSelected.size} seleccionada${state.collectionSelected.size === 1 ? '' : 's'}</span>
        ${canDelete && canBulk ? button('Eliminar seleccionadas', 'collections-bulk-delete', { danger: true }) : ''}
        ${button('Exportar selección', 'collections-export-selected')}
        ${button('Limpiar', 'collections-clear-selection')}
      </div>
      ${collectionsWarning}
      ${!state.collectionsReady ? '<div class="tt-commerce-loading">Cargando colecciones…</div>' : collectionsUnavailable ? '' : page.items.length ? `
      <label class="tt-collection-select-page"><input type="checkbox" data-check-all="collections" ${allVisibleSelected ? 'checked' : ''} aria-label="Seleccionar esta página de colecciones"><span>Seleccionar esta página</span></label>
      <div class="tt-commerce-tablewrap">
        <table class="tt-commerce-table tt-commerce-collection-grid">
          <thead><tr><th class="checkcol">Selección</th><th>Colección</th><th>Visibilidad</th><th>Productos</th><th>Orden</th><th></th></tr></thead>
          <tbody>${page.items.map(collectionItem => {
            const count = collectionProductCount(collectionItem.slug);
            const selected = state.collectionSelected.has(collectionItem.slug);
            return `<tr data-open="collection" data-id="${esc(collectionItem.slug)}" class="${selected ? 'is-selected' : ''}">
              <td class="checkcol" data-stop><label class="tt-commerce-product-check"><input type="checkbox" data-select-collection="${esc(collectionItem.slug)}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${esc(collectionItem.name || collectionItem.slug)}"></label></td>
              <td class="tt-collection-main"><div class="tt-commerce-collectioncell">${thumbHtml(collectionItem.image, collectionItem.name || 'Colección')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(collectionItem.name || collectionItem.slug)}</div><div class="tt-commerce-subtext">/${esc(collectionItem.slug)}</div></div></div></td>
              <td class="tt-collection-state" data-stop><span class="tt-commerce-badge ${collectionItem.visible === false ? 'warning' : 'success'}">${collectionItem.visible === false ? 'Oculta' : 'Visible'}</span><label class="tt-collection-visibility"><span>Estado</span><select data-collection-visible="${esc(collectionItem.slug)}" aria-label="Estado de ${esc(collectionItem.name || collectionItem.slug)}" ${state.busy || !canToggle?'disabled':''}><option value="true" ${collectionItem.visible!==false?'selected':''}>Activa</option><option value="false" ${collectionItem.visible===false?'selected':''}>Inactiva</option></select></label></td>
              <td class="tt-collection-count"><span>Productos</span><strong>${count}</strong></td>
              <td class="tt-collection-order"><span>Orden</span><strong>${Number(collectionItem.order) || 0}</strong></td>
              <td class="tt-collection-menu" data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="collection" data-id="${esc(collectionItem.slug)}" aria-label="Acciones">⋯</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : '<div class="tt-commerce-empty">No hay colecciones que coincidan con esta vista.</div>'}
      <div class="tt-commerce-footer"><span>${rangeLabel(page, 'colecciones', collectionsUnavailable)}</span><span>El orden y la visibilidad impactan la tienda pública.</span>${pageControls('collections-page', page.page, page.pages)}</div>
    </div>`);
  if(focusedId)root.querySelector(`[data-collection-visible="${CSS.escape(focusedId)}"]`)?.focus({preventScroll:true});
  else if(pageSelectionFocused)root.querySelector('[data-check-all="collections"]')?.focus({preventScroll:true});
}

function orderStatusBadge(status) {
  if (status === 'entregado') return 'success';
  if (['cancelado', 'rechazado'].includes(status)) return 'error';
  if (['en_camino', 'listo_retiro'].includes(status)) return 'warning';
  return '';
}
function payStatusBadge(status) {
  if (status === 'pagado') return 'success';
  if (['rechazado', 'cancelado'].includes(status)) return 'error';
  if (status === 'reembolsado') return 'neutral';
  return 'warning';
}

function renderOrders() {
  const root = document.getElementById('tt-commerce-orders'); if (!root) return;
  if (['buyers','deleted'].includes(state.orderTab)) {root.style.removeProperty('--tt-order-selection-space');return renderOrderArchive();}
  if(state.user)try {sessionStorage.setItem(`tt-orders-ui:${state.user.uid}`,JSON.stringify({tab:state.orderTab,stage:state.orderStage,search:state.orderSearch,pay:state.orderPay,delivery:state.orderDelivery,sort:state.orderSort}));}catch{}
  renderOrderBoard(root, { orders: filteredOrders(), allOrders: state.orders,
    selected: state.orderSelected, canBulk: perm('pedidos','accionesMasivas','manageOrders'),
    canUpdate: perm('pedidos','cambiarEstado','manageOrders'), isSuper: state.role === 'superadmin',
    busyIds: state.orderBusyIds, ready: state.ordersReady, error: state.ordersError,
    offline: navigator.onLine === false, payLabels: PAY_STATUS_LABELS,
    tab: state.orderTab, stage: state.orderStage, visible: state.orderVisible,
    search: state.orderSearch, pay: state.orderPay, delivery: state.orderDelivery,
    sort: state.orderSort, sound: state.orderSound, includeTestOrders: state.includeTestOrders });
}

function orderTestToggle() {return state.role==='superadmin'?button(state.includeTestOrders?'Ocultar pedidos de prueba':'Mostrar pedidos de prueba','orders-toggle-tests',{extra:`aria-pressed="${state.includeTestOrders}"`}):'';}

function renderOrderArchive() {
  const root = document.getElementById('tt-commerce-orders'); if (!root) return;
  if (state.orderTab === 'buyers') {
    root.innerHTML = `<div class="tt-commerce-pagehead"><div class="tt-commerce-titlegroup"><h1 class="tt-commerce-title">Pedidos · Clientes que compraron</h1><p>Compradores de Sheets y de la tienda, con sus pedidos e importes.</p></div></div><div class="tt-commerce-card">${orderTestToggle()}<div class="tt-commerce-tabs">${tabButton('orders', 'all', 'Todos los pedidos', state.orders.length, state.orderTab)}${tabButton('orders', 'buyers', 'Clientes que compraron', '', state.orderTab)}</div><p data-local-status role="status">Consultando compradores…</p><button type="button" class="adm-btn adm-btn-outline" data-local-refresh>Actualizar</button><div id="local-order-buyers"></div></div>`;
    window.dispatchEvent(new Event('tintin:show-order-buyers'));
    return;
  }
  const counts = orderTabCounts(), list = filteredOrders(), showingTrash = state.orderTab === 'deleted';
  const metrics = orderMetrics();
  const sourceTotal = showingTrash ? state.trashOrders.length : state.orders.length;
  const page = pageSlice(list, state.orderPage);
  state.orderPage = page.page;
  const selectedVisible = showingTrash ? 0 : page.items.filter(o => state.orderSelected.has(o.id)).length;
  const allVisibleSelected = !showingTrash && page.items.length > 0 && selectedVisible === page.items.length;
  const canBulk = !showingTrash && perm('pedidos', 'accionesMasivas', 'manageOrders');
  const canExport = perm('pedidos', 'exportar', 'manageOrders') || state.role === 'viewer';
  const canUpdate = !showingTrash && perm('pedidos', 'cambiarEstado', 'manageOrders');
  const canUpdatePay = !showingTrash && perm('pedidos', 'cambiarPago', 'manageOrders');
  const isSuper = state.role === 'superadmin';
  const ordersUnavailable = Boolean(!showingTrash && state.ordersError && !state.orders.length);
  const ordersWarning = !showingTrash && state.ordersError && state.orders.length
    ? `<div class="tt-commerce-error" role="alert">${esc(state.ordersError)} Se muestran los últimos datos confirmados. <button type="button" class="tt-commerce-btn" data-action="orders-retry">Reintentar</button></div>`
    : '';
  // Con error, las métricas no son actuales aunque haya filas confirmadas previas.
  const metricsUnavailable = Boolean(!showingTrash && state.ordersError);
  const metricValue = value => metricsUnavailable ? '—' : value;
  const metricMoney = value => metricsUnavailable ? '—' : formatMoney(value);
  const tableRows = page.items.map(order => {
    const customer = orderCustomer(order);
    const shipping = orderShipping(order);
    const status = orderStatus(order);
    const pay = payStatus(order);
    const items = orderItems(order);
    const selected = !showingTrash && state.orderSelected.has(order.id);
    const channel = order.channel || order.source || 'Tienda web';
    const itemCount = items.reduce((sum, item) => sum + Number(item?.qty ?? item?.quantity ?? 1), 0);
    const delivery = [shipping.method, shipping.city].filter(value => value && value !== '—').join(' · ') || 'Sin indicar';
    const date = formatDate(showingTrash ? (order.trashMeta?.trashedAt || order.updatedAt || order.createdAt) : order.createdAt);
    return `<tr ${showingTrash ? '' : 'data-open="order"'} data-id="${esc(order.id)}" class="${selected ? 'is-selected' : ''}">
      <td class="checkcol" data-label="Seleccionar" data-stop>${showingTrash ? '' : `<input type="checkbox" data-select-order="${esc(order.id)}" ${selected ? 'checked' : ''}>`}</td>
      <td data-label="Pedido"><div class="tt-commerce-maintext">#${esc(orderDisplayId(order))}</div><div class="tt-commerce-subtext">${showingTrash ? 'Recuperable' : order.localEntryId && !itemCount ? 'Detalle no registrado' : itemCount + ' artículo' + (itemCount === 1 ? '' : 's')}</div></td>
      <td data-label="Fecha">${esc(date)}</td>
      <td data-label="Cliente"><div class="tt-commerce-maintext">${esc(customer.name)}</div><div class="tt-commerce-subtext">${esc(customer.email || customer.phone || 'Sin contacto')}</div></td>
      <td data-label="Canal">${esc(channel)}</td>
      <td data-label="Pago"><span class="tt-commerce-badge ${payStatusBadge(pay)}">${esc(PAY_STATUS_LABELS[pay] || pay)}</span></td>
      <td data-label="Preparación"><span class="tt-commerce-badge ${orderStatusBadge(status)}">${esc(ORDER_STATUS_LABELS[status] || status)}</span></td>
      <td class="tt-commerce-number" data-label="Artículos">${order.localEntryId && !itemCount ? '—' : itemCount}</td>
      <td data-label="Entrega"><span class="tt-commerce-delivery">${esc(delivery)}</span></td>
      <td data-label="Total"><span class="tt-commerce-money">${formatMoney(order.total)}</span></td>
      <td data-label="Acciones" data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="${showingTrash ? 'trash-order' : 'order'}" data-id="${esc(order.id)}" aria-label="Acciones del pedido">⋯</button></td>
    </tr>`;
  }).join('');
  const loading = showingTrash && !state.trashReady
    ? '<div class="tt-commerce-loading">Cargando Borrados…</div>'
    : !showingTrash && !state.ordersReady
      ? '<div class="tt-commerce-loading">Cargando pedidos…</div>'
      : state.ordersError && !list.length
        ? `<div class="tt-commerce-error" role="alert">${esc(state.ordersError)} <button type="button" class="tt-commerce-btn" data-action="orders-retry">Reintentar</button></div>`
        : page.items.length
          ? `<div class="tt-commerce-tablewrap"><table class="tt-commerce-table tt-commerce-orders-table"><thead><tr><th class="checkcol">${showingTrash ? '' : `<input type="checkbox" data-check-all="orders" ${allVisibleSelected ? 'checked' : ''}>`}</th><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Preparación</th><th>Artículos</th><th>Entrega</th><th>Total</th><th></th></tr></thead><tbody>${tableRows}</tbody></table></div>`
          : `<div class="tt-commerce-empty">${showingTrash ? 'No hay pedidos en Borrados.' : 'No hay pedidos para estos filtros.'}</div>`;
  const canLoadMore = !showingTrash && state.ordersHasMore && !state.ordersError;
  const pagination = !showingTrash ? pageControls('orders-page', page.page, page.pages, { hasMore: canLoadMore, loading: state.ordersLoadingMore }) : '';
  const loadedHint = !showingTrash && (state.ordersHasMore || page.pages > 1) ? 'La vista está paginada en bloques de 30.' : '';
  root.innerHTML = `
    <div class="tt-commerce-pagehead"><div class="tt-commerce-titlegroup"><h1 class="tt-commerce-title">Pedidos <span class="tt-commerce-count">${!showingTrash && state.ordersError ? "—" : sourceTotal}</span></h1><div class="tt-commerce-subtitle">${showingTrash ? 'Pedidos retirados de la lista activa. Podés restaurarlos o eliminarlos definitivamente.' : 'Pago, preparación, entrega y datos del pedido en una sola vista.'}</div></div><div class="tt-commerce-actions">${isSuper ? button('Verificar TINPED', 'orders-reset-sequence') + button('+ Nuevo pedido', 'orders-manual-new', { primary: true }) : ''}${canExport ? button('Exportar', 'orders-export') : ''}</div></div>
    ${!showingTrash ? `<div class="tt-commerce-order-metrics" aria-label="Resumen del grupo cargado de pedidos"><div><strong>${metricValue(metrics.today)}</strong><span>Pedidos hoy</span></div><div><strong>${metricMoney(metrics.revenue)}</strong><span>Ventas de hoy</span></div><div><strong>${metricValue(metrics.pending)}</strong><span>Pagos pendientes</span></div><div><strong>${metricValue(metrics.unfulfilled)}</strong><span>Sin preparar</span></div><div><strong>${metricValue(metrics.delivered)}</strong><span>Entregados</span></div><div><strong>${metricValue(metrics.items)}</strong><span>Artículos hoy</span></div></div>` : ''}
    <div class="tt-commerce-card">${orderTestToggle()}${ordersWarning}<div class="tt-commerce-tabs">${tabButton('orders', 'all', 'Todos', counts.all, state.orderTab)}${tabButton('orders', 'buyers', 'Clientes que compraron', '', state.orderTab)}${tabButton('orders', 'unpaid', 'Sin pagar', counts.unpaid, state.orderTab)}${tabButton('orders', 'unfulfilled', 'Sin entregar', counts.unfulfilled, state.orderTab)}${tabButton('orders', 'delivered', 'Entregados', counts.delivered, state.orderTab)}${tabButton('orders', 'canceled', 'Cancelados', counts.canceled, state.orderTab)}${tabButton('orders', 'refunded', 'Reembolsados', counts.refunded, state.orderTab)}${isSuper ? tabButton('orders', 'deleted', 'Borrados', counts.deleted, state.orderTab) : ''}</div><div class="tt-commerce-toolbar"><label class="tt-commerce-search"><input class="tt-commerce-input" data-filter="order-search" type="search" value="${esc(state.orderSearch)}" placeholder="TINPED, cliente, email o producto"></label><select class="tt-commerce-select" data-filter="order-status"><option value="">Todos los estados</option>${ORDER_STATUS_VALUES.map(v => `<option value="${v}" ${state.orderStatus === v ? 'selected' : ''}>${esc(ORDER_STATUS_LABELS[v])}</option>`).join('')}</select><select class="tt-commerce-select" data-filter="order-pay"><option value="">Todos los pagos</option>${PAY_STATUS_VALUES.map(v => `<option value="${v}" ${state.orderPay === v ? 'selected' : ''}>${esc(PAY_STATUS_LABELS[v])}</option>`).join('')}</select><select class="tt-commerce-select" data-filter="order-sort"><option value="date-desc" ${state.orderSort === 'date-desc' ? 'selected' : ''}>Más recientes</option><option value="date-asc" ${state.orderSort === 'date-asc' ? 'selected' : ''}>Más antiguos</option></select></div><div class="tt-commerce-bulkbar" ${state.orderSelected.size && canBulk ? '' : 'hidden'}><span class="tt-commerce-bulkcount">${state.orderSelected.size} seleccionado${state.orderSelected.size === 1 ? '' : 's'}</span>${canUpdate ? button('En preparación', 'orders-bulk-preparing') + button('En camino', 'orders-bulk-way') + button('Entregado', 'orders-bulk-delivered') : ''}${canUpdatePay ? button('Marcar pagado', 'orders-bulk-paid') : ''}${canExport ? button('Exportar selección', 'orders-export-selected') : ''}${button('Limpiar', 'orders-clear-selection')}</div>${loading}<div class="tt-commerce-footer"><span>${rangeLabel(page, 'pedidos cargados', ordersUnavailable)}</span><span>${esc(loadedHint || (showingTrash ? 'Restaurar no reutiliza ni altera el contador TINPED.' : 'El código TINPED es correlativo y no se reutiliza al borrar.'))}</span>${pagination}</div></div>`;
}

function renderAll() {
  renderProducts();
  renderCollections();
  renderOrders();
  renderDrawer();
}

function csvEscape(value) {
  let text = String(value ?? '');
  // Igual que toCsvValue en admin-app.js: un texto que empieza con =, +, -, @
  // (o tab/CR) se abriría como fórmula en Excel/Sheets. Nombres, correos y
  // ciudades vienen de clientas, así que se neutralizan con un apóstrofe.
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const text = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportProducts(selectedOnly = false) {
  const source = selectedOnly ? state.products.filter(p => state.productSelected.has(p._docId)) : filteredProducts();
  downloadCsv('tintin-productos.csv', [
    ['ID', 'SKU', 'Nombre', 'Colección', 'Precio', 'Precio anterior', 'Stock', 'Estado', 'Oferta', 'Destacado', 'Etiqueta', 'Tags', 'Imagen principal', 'Descripción', 'Variantes'],
    ...source.map(p => [p._docId, p.sku || '', p.name || '', p.category || '', p.price ?? '', p.priceBefore ?? '', p.stock ?? '', p.active === false ? 'Inactivo' : 'Activo', p.oferta ? 'Sí' : 'No', p.destacado ? 'Sí' : 'No',p.badge || '',Array.isArray(p.tags)?p.tags.join(', '):p.tags || '',productImage(p),p.description || p.desc || '',JSON.stringify(p.variants || {})])
  ]);
}

function exportCollections(selectedOnly = false) {
  const source = selectedOnly ? state.collections.filter(c => state.collectionSelected.has(c.slug)) : filteredCollections();
  downloadCsv('tintin-colecciones.csv', [
    ['Slug', 'Nombre', 'Descripción', 'Visible', 'Orden', 'Productos'],
    ...source.map(c => [c.slug, c.name || '', c.description || '', c.visible === false ? 'No' : 'Sí', c.order ?? 0, collectionProductCount(c.slug)])
  ]);
}

function exportOrders(selectedOnly = false) {
  const source = selectedOnly ? state.orders.filter(o => state.orderSelected.has(o.id)) : filteredOrders();
  downloadCsv('tintin-pedidos.csv', [['Pedido','ID técnico','Fecha','Cliente','Email','Teléfono','Estado','Pago','Método entrega','Ciudad','Total'], ...source.map(o => { const customer=orderCustomer(o), shipping=orderShipping(o); return [orderDisplayId(o),o.id,formatDate(o.createdAt),customer.name,customer.email,customer.phone,ORDER_STATUS_LABELS[orderStatus(o)]||orderStatus(o),PAY_STATUS_LABELS[payStatus(o)]||payStatus(o),shipping.method,shipping.city,o.total??0]; })]);
}

function closeMenu() {
  const menu = document.getElementById('tt-commerce-menu');
  if (menu) menu.hidden = true;
}

function menuItems(type, id) {
  if (type === 'product') { const product=state.products.find(p=>p._docId===id); if(!product)return[]; const out=[{label:'Ver detalles',action:'drawer-product'}]; if(perm('productos','crear','addProducts'))out.push({label:'Duplicar como borrador',action:'product-duplicate'}); if(state.role==='superadmin' && perm('pedidos','editar','editOrders'))out.push({label:'Agregar a una compra',action:'product-link-order'}); if(perm('productos','editar','editProducts'))out.push({label:'Editar producto',action:'product-edit'}); if(perm('productos','activarDesactivar','editProducts'))out.push({label:product.active===false?'Activar producto':'Desactivar producto',action:'product-toggle'}); if(state.role==='superadmin' && perm('productos','eliminar','deleteProducts'))out.push({sep:true},{label:'Eliminar producto',action:'product-delete',danger:true}); return out; }
  if (type === 'collection') { const c=state.collections.find(x=>x.slug===id); if(!c)return[]; const out=[{label:'Ver detalles',action:'drawer-collection'},{label:'Ver sus productos',action:'collection-products'}]; if(perm('colecciones','editar','manageContent'))out.push({label:'Editar colección',action:'collection-edit'}); if(perm('colecciones','eliminar','deleteCollections'))out.push({sep:true},{label:'Eliminar colección',action:'collection-delete',danger:true}); return out; }
  if (type === 'trash-order') return state.role==='superadmin' ? [{label:'Restaurar a Pedidos',action:'order-restore'},{sep:true},{label:'Eliminar definitivamente',action:'order-delete-permanent',danger:true}] : [];
  if (type === 'order') { const out=[{label:'Ver detalles',action:'drawer-order'}]; if(state.role==='superadmin')out.push({label:'CRUD completo',action:'order-edit-advanced'}); else if(perm('pedidos','editarCompleto','manageOrdersFull'))out.push({label:'Editar pedido completo',action:'order-edit'}); if(perm('pedidos','reenviarCorreo','manageOrders'))out.push({label:'Reenviar correo',action:'order-resend'}); if(perm('pedidos','eliminar','deleteOrders'))out.push({sep:true},{label:'Mover a Borrados',action:'order-delete',danger:true}); return out; }
  return [];
}

function openMenu(buttonEl, type, id) {
  let menu = document.getElementById('tt-commerce-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'tt-commerce-menu';
    menu.className = 'tt-commerce-menu';
    document.body.appendChild(menu);
  }
  const items = menuItems(type, id);
  menu.innerHTML = items.map(item => item.sep ? '<hr>' : `<button type="button" class="${item.danger ? 'danger' : ''}" data-menu-action="${item.action}" data-menu-type="${type}" data-menu-id="${esc(id)}">${esc(item.label)}</button>`).join('');
  const rect = buttonEl.getBoundingClientRect();
  menu.hidden = false;
  const width = 220;
  const left = Math.min(window.innerWidth - width - 10, Math.max(10, rect.right - width));
  const estimatedHeight = Math.min(320, items.length * 38 + 16);
  const top = Math.min(window.innerHeight - estimatedHeight - 10, rect.bottom + 5);
  menu.style.left = `${left}px`;
  menu.style.top = `${Math.max(10, top)}px`;
}

function ensureDrawerDom() {
  if (!document.getElementById('tt-commerce-drawer-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'tt-commerce-drawer-backdrop';
    backdrop.className = 'tt-commerce-drawer-backdrop';
    backdrop.dataset.action = 'drawer-close';
    document.body.appendChild(backdrop);
  }
  if (!document.getElementById('tt-commerce-drawer')) {
    const drawer = document.createElement('aside');
    drawer.id = 'tt-commerce-drawer';
    drawer.className = 'tt-commerce-drawer';
    drawer.setAttribute('aria-label', 'Detalles');
    document.body.appendChild(drawer);
  }
}

let productReturnFocus=null;
function openDrawer(type, id, opener=document.activeElement) {
  if(type==='product') productReturnFocus={element:opener,id};
  if(type==='order') { orderReturnFocus=document.activeElement;refreshOrderHistory(id);refreshOrderContacts(id); }
  state.drawer = { type, id, baseChangeId: type==='order' ? state.orders.find(o=>o.id===id)?.lastChangeId || '' : '' };
  renderDrawer();
}

function closeDrawer() {
  const wasProduct=state.drawer?.type==='product';
  const wasOrder=state.drawer?.type==='order';
  const orderId=state.drawer?.id;
  state.drawer = null;renderDrawer();
  syncProductSurfaces();
  if(wasProduct && productReturnFocus) {
    const candidate=productReturnFocus.element;
    const target=candidate?.isConnected && candidate.matches('button,a[href],input,select,textarea,[tabindex]') ? candidate : [...document.querySelectorAll('.tt-commerce-product-open')].find(node=>node.dataset.id===productReturnFocus.id);target?.focus({preventScroll:true});
  }
  if(wasOrder) { const target=orderReturnFocus?.isConnected ? orderReturnFocus : [...document.querySelectorAll('[data-action="drawer-order"]')].find(e=>e.dataset.id===orderId);target?.focus?.({preventScroll:true}); }
}

function drawerOrderPending(orderId) {
  if (state.drawer?.type !== 'order' || state.drawer.id !== orderId) return {};
  return state.drawer.pending || {};
}

function drawerOrderHasPending(orderId) {
  const pending=drawerOrderPending(orderId), order=state.orders.find(o=>o.id===orderId);
  return Boolean(String(pending.statusNote || '').trim()) || (pending.status != null && pending.status !== orderStatus(order)) || (pending.payment != null && pending.payment !== payStatus(order));
}

function kvRow(label, value) {
  return `<dt>${esc(label)}</dt><dd>${value == null || value === '' ? '—' : esc(value)}</dd>`;
}

function productDrawer(product) {
  if (!product) return null;
  const status = productStatus(product);
  const collectionItem = state.collections.find(c => wristCategory(c.slug) === wristCategory(product.category || product.cat));
  const variants = productVariantsCount(product);
  const gallery=[...new Set([productImage(product),...(Array.isArray(product.imagesExtra)?product.imagesExtra:[]),...(Array.isArray(product.variantMedia)?product.variantMedia.flatMap(row=>[row.imageUrl,...(Array.isArray(row.imageUrls)?row.imageUrls:[])]):[])].map(sanitizeImageUrl).filter(Boolean))];
  const imageIndex=Math.min(Number(state.drawer?.imageIndex)||0,Math.max(0,gallery.length-1));
  const specs = [['Material','material'],['Medidas','measurements'],['Color / acabado','colorFinish'],['Cuidados','care'],['Resistencia al agua','waterResistance'],['Garantía','warranty'],['Talle / ajuste','sizeFit'],['Contenido del paquete','packageContents']]
    .filter(([,field]) => product[field]).map(([label,field]) => kvRow(label,product[field])).join('');
  const options = product.variants && !Array.isArray(product.variants)
    ? Object.entries(product.variants).filter(([,values]) => Array.isArray(values)).map(([label,values]) => kvRow(label,values.join(', '))).join('') : '';
  const inventory = Array.isArray(product.variantInventory)
    ? product.variantInventory.filter(item => item && typeof item === 'object').map(item => kvRow(String(item.variant || 'Variante'),String(item.stock ?? 'Sin control'))).join('') : '';
  return {
    title: product.name || 'Producto sin nombre',
    kicker: `Producto · ${product._docId}`,
    body: `
      <div class="tt-commerce-drawer-section tt-commerce-product-preview">${thumbHtml(gallery[imageIndex] || '', product.name || 'Producto')}${gallery.length>1?`<div class="tt-product-gallery" role="group" aria-label="Fotos del producto">${gallery.map((image,index)=>`<button type="button" data-action="product-photo" data-photo-index="${index}" aria-label="Ver foto ${index+1}" aria-pressed="${index===imageIndex}"><img src="${esc(image)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}<div><span class="tt-commerce-badge ${status.cls}">${status.label}</span><div style="margin-top:7px;font-size:16px;font-weight:780">${formatMoney(product.price)}</div></div></div>
      <div class="tt-commerce-drawer-section"><h4>Información</h4><dl class="tt-commerce-kv">${kvRow('SKU',product.sku)}${kvRow('Creado',timestampMillis(product.createdAt)?formatDate(product.createdAt):'')}${kvRow('Actualizado',timestampMillis(product.updatedAt)?formatDate(product.updatedAt):'')}${kvRow('Colección', collectionItem?.name || product.category || 'Sin colección')}${kvRow('Etiqueta interna',product.collection)}${kvRow('Precio anterior',Number(product.priceBefore)>0?formatMoney(product.priceBefore):'')}${kvRow('Stock', product.stock == null ? 'Sin control' : String(product.stock))}${kvRow('Variantes', variants ? String(variants) : 'Sin variantes')}${kvRow('Oferta', product.oferta ? 'Sí' : 'No')}${kvRow('Destacado', product.destacado ? 'Sí' : 'No')}${kvRow('Tags',Array.isArray(product.tags)?product.tags.join(', '):product.tags)}</dl></div>
      <div class="tt-commerce-drawer-section"><h4>Descripción</h4><div class="tt-commerce-description">${product.description || product.desc ? esc(product.description || product.desc) : '<span class="tt-commerce-subtext">Este producto todavía no tiene descripción.</span>'}</div></div>
      ${specs ? `<div class="tt-commerce-drawer-section"><h4>Ficha técnica</h4><dl class="tt-commerce-kv">${specs}</dl></div>` : ''}
      ${options ? `<div class="tt-commerce-drawer-section"><h4>Opciones</h4><dl class="tt-commerce-kv">${options}</dl></div>` : ''}
      ${inventory ? `<div class="tt-commerce-drawer-section"><h4>Stock por variante</h4><dl class="tt-commerce-kv">${inventory}</dl></div>` : ''}
    `,
    actions: `
      ${perm('productos', 'editar', 'editProducts') ? button('Editar', 'drawer-product-edit', { primary: true, extra: `data-id="${esc(product._docId)}"` }) : ''}
      ${perm('productos','crear','addProducts') ? button('Duplicar','product-duplicate',{extra:`data-id="${esc(product._docId)}"`}) : ''}
      ${state.role==='superadmin' && perm('pedidos','editar','editOrders') ? button('Agregar a una compra','product-link-order',{extra:`data-id="${esc(product._docId)}"`}) : ''}
      ${perm('productos', 'activarDesactivar', 'editProducts') ? button(product.active === false ? 'Activar' : 'Desactivar', 'drawer-product-toggle', { extra: `data-id="${esc(product._docId)}"` }) : ''}
      ${state.role==='superadmin' && perm('productos', 'eliminar', 'deleteProducts') ? button('Eliminar', 'drawer-product-delete', { danger: true, extra: `data-id="${esc(product._docId)}"` }) : ''}
    `
  };
}

function collectionDrawer(collectionItem) {
  const products = state.products.filter(p => wristCategory(p.category || p.cat) === wristCategory(collectionItem.slug)).sort((a, b) => (Number(a.collectionOrder ?? 9999) - Number(b.collectionOrder ?? 9999)));
  return {
    title: collectionItem.name || collectionItem.slug,
    kicker: `Colección · /${collectionItem.slug}`,
    body: `
      ${collectionItem.image ? `<div class="tt-commerce-drawer-section" style="display:flex;gap:12px;align-items:center">${thumbHtml(collectionItem.image, collectionItem.name || 'Colección')}<span class="tt-commerce-badge ${collectionItem.visible === false ? 'neutral' : 'success'}">${collectionItem.visible === false ? 'Oculta' : 'Visible'}</span></div>` : ''}
      <div class="tt-commerce-drawer-section"><h4>Configuración</h4><dl class="tt-commerce-kv">${kvRow('Productos', String(products.length))}${kvRow('Orden', String(Number(collectionItem.order) || 0))}${kvRow('Visibilidad', collectionItem.visible === false ? 'Oculta' : 'Visible')}</dl></div>
      ${collectionItem.description ? `<div class="tt-commerce-drawer-section"><h4>Descripción</h4><div style="font-size:11px;line-height:1.6;color:var(--tt-commerce-muted)">${esc(collectionItem.description)}</div></div>` : ''}
      <div class="tt-commerce-drawer-section"><h4>Productos</h4>${products.slice(0, 8).map(p => `<div class="tt-commerce-lineitem">${thumbHtml(productImage(p), p.name || 'Producto')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(p.name || 'Sin nombre')}</div><div class="tt-commerce-subtext">${p.stock == null ? 'Stock sin límite' : `${Number(p.stock)} en stock`}</div></div><span class="tt-commerce-lineitem-price">${formatMoney(p.price)}</span></div>`).join('') || '<div class="tt-commerce-subtext">Todavía no hay productos.</div>'}${products.length > 8 ? `<div class="tt-commerce-subtext" style="margin-top:8px">+ ${products.length - 8} productos más</div>` : ''}</div>
    `,
    actions: `
      ${perm('colecciones', 'editar', 'manageContent') ? button('Editar', 'drawer-collection-edit', { primary: true, extra: `data-id="${esc(collectionItem.slug)}"` }) : ''}
      ${button('Ver productos', 'drawer-collection-products', { extra: `data-id="${esc(collectionItem.slug)}"` })}
      ${perm('colecciones', 'eliminar', 'deleteCollections') ? button('Eliminar', 'drawer-collection-delete', { danger: true, extra: `data-id="${esc(collectionItem.slug)}" data-count="${products.length}"` }) : ''}
    `
  };
}

function orderDrawer(order) {
  if(!order) return null;
  const customer = orderCustomer(order);
  const shipping = orderShipping(order);
  const items = orderItems(order);
  const status = orderStatus(order);
  const pay = payStatus(order);
  const canEditStatus = perm('pedidos', 'cambiarEstado', 'manageOrders');
  const canEditPay = perm('pedidos', 'cambiarPago', 'manageOrders');
  const canSensitive = state.role === 'superadmin' || canDo(state.role, 'pedidos', 'verDatosSensibles');
  const canAddress = state.role === 'superadmin' || canDo(state.role, 'pedidos', 'verDireccion');
  const pending = drawerOrderPending(order.id);
  const selectedStatus = Object.prototype.hasOwnProperty.call(pending, 'status') ? pending.status : status;
  const contact = state.orderContacts?.get(order.id)?.links || {};
  const history = state.orderHistory.get(order.id);
  const selectedPay = Object.prototype.hasOwnProperty.call(pending, 'payment') ? pending.payment : pay;
  const hasPending = drawerOrderHasPending(order.id);
  return {
    title: `#${orderDisplayId(order)}`,
    kicker: formatDate(order.createdAt),
    body: `
      <div class="tt-commerce-drawer-section"><h4>Origen del pedido</h4><dl class="tt-commerce-kv">${kvRow('Origen',order.localEntryId ? 'Venta local (manual)' : order.source || order.channel || (String(order.id).startsWith('manual_') ? 'Manual' : 'Sin origen registrado'))}${kvRow('Identificador',order.id)}</dl></div>
      <div class="tt-commerce-drawer-section"><div style="display:flex;gap:7px;flex-wrap:wrap"><span class="tt-commerce-badge ${payStatusBadge(pay)}">${esc(PAY_STATUS_LABELS[pay] || pay)}</span><span class="tt-commerce-badge ${orderStatusBadge(status)}">${esc(orderStatusLabel(order))}</span></div></div>
      <div class="tt-commerce-drawer-section"><h4>Cliente</h4><dl class="tt-commerce-kv">${kvRow('Nombre', customer.name)}${canSensitive ? kvRow('Email', customer.email) + kvRow('Teléfono', customer.phone) : ''}</dl></div>
      <div class="tt-commerce-drawer-section"><h4>Productos</h4>${items.map(item => `<div class="tt-commerce-lineitem">${thumbHtml(itemImage(item), item?.name || item?.title || 'Producto')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(item?.name || item?.title || 'Producto')}</div><div class="tt-commerce-subtext">${esc(item.variant || item.variantName || '')}<br>${Number(item?.qty || item?.quantity || 1)} × ${formatMoney(item?.price)}</div></div><span class="tt-commerce-lineitem-price">${formatMoney(Number(item?.qty || item?.quantity || 1) * Number(item?.price || 0))}</span></div>`).join('') || '<div class="tt-commerce-subtext">Sin productos registrados.</div>'}</div>
      <div class="tt-commerce-drawer-section"><h4>Totales</h4><dl class="tt-commerce-kv">${kvRow('Subtotal', formatMoney(order.subtotal))}${kvRow('Envío', formatMoney(order.shippingCost ?? order.shipping?.cost ?? 0))}${order.discount || order.coupon?.discount || order.coupon?.shippingDiscount ? kvRow('Descuento registrado',formatMoney(order.discount || order.coupon.discount || order.coupon.shippingDiscount)) : ''}${kvRow('Total', formatMoney(order.total))}</dl></div>
      <div class="tt-commerce-drawer-section"><h4>Entrega</h4><dl class="tt-commerce-kv">${kvRow('Método', deliveryLabel(order))}${kvRow('Fecha prevista',order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : 'No registrada')}${kvRow('Ciudad', shipping.city)}${canAddress ? kvRow('Dirección', shipping.address) + kvRow('Referencia', shipping.reference || shipping.agency || shipping.mode) : ''}</dl></div>
      ${(canEditStatus || canEditPay) ? `<div class="tt-commerce-drawer-section"><h4>Actualizar</h4><div style="display:grid;gap:8px">${canEditStatus ? `<select class="tt-commerce-select" aria-label="Estado del pedido" data-drawer-order-status="${esc(order.id)}">${allowedOrderStatuses(order).map(v => `<option value="${v}" ${selectedStatus === v ? 'selected' : ''}>${esc(orderStatusLabel({...order,status:v}))}</option>`).join('')}</select>` : ''}${canEditPay ? `<select class="tt-commerce-select" aria-label="Estado del pago" data-drawer-order-pay="${esc(order.id)}">${PAY_STATUS_VALUES.map(v => `<option value="${v}" ${selectedPay === v ? 'selected' : ''}>${esc(PAY_STATUS_LABELS[v])}</option>`).join('')}</select>` : ''}</div><label class="tt-commerce-subtext">Observación del movimiento<textarea class="tt-commerce-input" data-drawer-order-note="${esc(order.id)}" maxlength="1000" rows="2">${esc(pending.statusNote || '')}</textarea></label>${hasPending ? '<div class="tt-commerce-subtext" style="margin-top:8px;color:var(--tt-commerce-brand);font-weight:700">Cambios pendientes de guardar.</div>' : '<div class="tt-commerce-subtext" style="margin-top:8px">Elegí un estado y después presioná Guardar cambios.</div>'}</div>` : ''}
      ${state.role === 'superadmin' ? `<div class="tt-commerce-drawer-section"><h4>Historial</h4><p>Creado: ${esc(formatDate(order.createdAt))}</p>${history?.loading ? '<p>Consultando movimientos…</p>' : history?.error ? `<p role="alert">${esc(history.error)}</p><button type="button" class="tt-commerce-btn" data-action="order-history-retry" data-id="${esc(order.id)}">Reintentar</button>` : `<ol class="tt-order-history">${(history?.items || []).map(e=>`<li><strong>${esc(formatDate(e.createdAt || e.timestamp))}</strong><br>${esc(e.actorEmail || e.actorId || 'Responsable no registrado')}<br>${esc(e.before?.status || '')} → ${esc(e.after?.status || e.action || 'Movimiento registrado')}${e.notes ? `<br>${esc(e.notes)}` : ''}</li>`).join('')}</ol>${!history?.items?.length ? '<p>Sin movimientos históricos registrados.</p>' : ''}`}</div>` : ''}
      ${order.notes ? `<div class="tt-commerce-drawer-section"><h4>Notas</h4><div style="font-size:11px;line-height:1.6;color:var(--tt-commerce-muted)">${esc(order.notes)}</div></div>` : ''}
    `,
    actions: `
      ${(canEditStatus || canEditPay) ? button('Guardar cambios', 'drawer-order-save', { primary: true, disabled: !hasPending, extra: `data-id="${esc(order.id)}"` }) : ''}
      ${perm('pedidos', 'editarCompleto', 'manageOrdersFull') ? button('Editar pedido', 'drawer-order-edit', { primary: true, extra: `data-id="${esc(order.id)}"` }) : ''}
      ${canSensitive && contact.customer ? `<a class="tt-commerce-btn" href="${esc(contact.customer)}" target="_blank" rel="noopener noreferrer">WhatsApp del cliente</a>` : ''}${canAddress && contact.map ? `<a class="tt-commerce-btn" href="${esc(contact.map)}" target="_blank" rel="noopener noreferrer">Google Maps</a>` : ''}${canAddress && !contact.map ? '<span class="tt-commerce-subtext">Sin ubicación válida en el mapa.</span>' : ''}${state.role==='superadmin' && contact.dispatch ? `<a class="tt-commerce-btn" href="${esc(contact.dispatch)}" target="_blank" rel="noopener noreferrer">Enviar a Fito</a>` : ''}
      ${state.orderContacts.get(order.id)?.loading ? '<span class="tt-commerce-subtext">Consultando contactos…</span>' : state.orderContacts.get(order.id)?.error ? `<button type="button" class="tt-commerce-btn" data-action="order-contacts-retry" data-id="${esc(order.id)}">Reintentar contactos</button>` : ''}
      ${perm('pedidos', 'reenviarCorreo', 'manageOrders') ? button('Reenviar correo', 'drawer-order-resend', { extra: `data-id="${esc(order.id)}"` }) : ''}
      ${perm('pedidos', 'eliminar', 'deleteOrders') ? button('Eliminar', 'drawer-order-delete', { danger: true, extra: `data-id="${esc(order.id)}"` }) : ''}
    `
  };
}

async function saveDrawerOrder(id) {
  if (navigator.onLine === false || state.ordersError || !state.ordersReady) return toast('Esperá a recuperar la sincronización antes de guardar.');
  const order = state.orders.find(item => item.id === id);
  const pending = drawerOrderPending(id);
  if (!order || !Object.keys(pending).length || state.busy) return;
  const status = orderStatus(order);
  const pay = payStatus(order);
  const statusChanged = Object.prototype.hasOwnProperty.call(pending, 'status') && pending.status !== status;
  const payChanged = Object.prototype.hasOwnProperty.call(pending, 'payment') && pending.payment !== pay;
  if (!statusChanged && !payChanged && !pending.statusNote) {
    state.drawer.pending = {};
    return renderDrawer();
  }

  setBusy(true);
  try {
    const context={baseChangeId:state.drawer.baseChangeId || '',changeId:`board_${crypto.randomUUID().replaceAll('-','')}`};
    if(payChanged)context.paymentStatus=pending.payment;
    if(pending.statusNote)context.statusNote=pending.statusNote;
    if (typeof window.updateOrderStatus !== 'function') throw new Error('La acción todavía está cargando.');
    if (!await window.updateOrderStatus(id,statusChanged ? pending.status : status,context)) throw new Error('No se pudo confirmar el cambio. El pedido puede haber cambiado en otra sesión; revisá los datos sincronizados.');
    if(state.drawer?.type==='order' && state.drawer.id===id) {state.drawer.pending={};state.drawer.baseChangeId=state.orders.find(o=>o.id===id)?.lastChangeId || '';}
    toast('Cambios del pedido guardados.');
    renderOrders();
    renderDrawer();
  } catch (error) {
    console.error('[shopify-commerce] saveDrawerOrder:', error);
    toast(error.message || 'No se pudieron guardar los cambios.', 5200);
    renderDrawer();
  } finally {
    setBusy(false);
  }
}

function renderDrawer() {
  ensureDrawerDom();
  const drawer = document.getElementById('tt-commerce-drawer');
  const backdrop = document.getElementById('tt-commerce-drawer-backdrop');
  if (!state.drawer) {
    drawer.hidden=true;drawer.removeAttribute('aria-modal');drawer.removeAttribute('role');drawer.dataset.kind='';
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.innerHTML = '';
    syncProductSurfaces();
    return;
  }

  let content = null;
  drawer.hidden=false;
  if (state.drawer.type === 'product') content = productDrawer(state.products.find(p => p._docId === state.drawer.id));
  if (state.drawer.type === 'collection') content = collectionDrawer(state.collections.find(c => c.slug === state.drawer.id));
  if (state.drawer.type === 'order') content = orderDrawer(state.orders.find(o => o.id === state.drawer.id));
  if (!content) { state.drawer = null; renderDrawer(); return; }

  drawer.dataset.kind=state.drawer.type;
  if(state.drawer.type==='order' || state.drawer.type==='product'){drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label',`${state.drawer.type==='product'?'Producto':'Detalles del pedido'} ${content.title}`);}
  else { drawer.removeAttribute('role');drawer.removeAttribute('aria-modal');drawer.setAttribute('aria-label','Detalles'); }
  const focusBefore=document.activeElement;
  const focusAttribute=drawer.contains(focusBefore) ? ['data-photo-index','data-drawer-order-status','data-drawer-order-pay','data-drawer-order-note','data-action','href','id','name'].find(attribute=>focusBefore.hasAttribute(attribute)) : null;
  const focusKey=focusAttribute ? `[${focusAttribute}="${CSS.escape(focusBefore.getAttribute(focusAttribute))}"]` : null;
  const selection=focusKey && typeof focusBefore.selectionStart==='number' ? [focusBefore.selectionStart,focusBefore.selectionEnd,focusBefore.selectionDirection] : null;
  const bodyScroll=drawer.querySelector('.tt-commerce-drawer-body')?.scrollTop || 0;
  drawer.innerHTML = `<div class="tt-commerce-drawer-head"><div class="tt-commerce-drawer-heading"><h3 class="tt-commerce-drawer-title">${esc(content.title)}</h3><div class="tt-commerce-drawer-kicker">${esc(content.kicker)}</div></div><button type="button" class="tt-commerce-iconbtn" data-action="drawer-close" aria-label="Cerrar">×</button></div><div class="tt-commerce-drawer-body">${content.body}</div><div class="tt-commerce-drawer-actions">${content.actions}</div>`;
  if(focusKey) {
    const control=drawer.querySelector(focusKey) || drawer.querySelector('[data-action="drawer-close"]');
    control?.focus({preventScroll:true});
    if(selection && control?.setSelectionRange)control.setSelectionRange(...selection);
  }
  const orderBody=drawer.querySelector('.tt-commerce-drawer-body');if(orderBody)orderBody.scrollTop=bodyScroll;
  if((state.drawer.type==='order' || state.drawer.type==='product') && !drawer.classList.contains('open'))drawer.querySelector('[data-action="drawer-close"]')?.focus();
  const renderedDrawer=state.drawer;
  requestAnimationFrame(() => {
    // Un cierre o cambio de ficha invalida la apertura pendiente del frame anterior.
    if(state.drawer!==renderedDrawer || drawer.hidden)return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    syncProductSurfaces();
  });
}

function setBusy(value) {
  state.busy = value;
  document.querySelectorAll('.tt-commerce-btn').forEach(btn => {
    if (value) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  });
}

function editProductSelection(products,options={}) {
  const uid=state.user?.uid;
  if(!uid || !state.productsReady || state.productsError || navigator.onLine===false)return toast('Esperá a recuperar la sincronización del catálogo.');
  return openProductBulkEditor({products,collections:state.collections,...options,
    apply:request=>{
      if(state.user?.uid!==uid)throw Error('La sesión cambió. Volvé a abrir la selección.');
      if(typeof window.TintinProductAdmin?.applyBulkChanges!=='function')throw Error('El controlador de productos todavía está cargando.');
      return window.TintinProductAdmin.applyBulkChanges(request);
    },
    onConfirmed:result=>{
      if(state.user?.uid!==uid)return;
      result.ids.forEach(id=>state.productSelected.delete(id));
      toast(`${result.ids.length} productos guardados.${result.syncPending?' Sincronización externa pendiente.':''}${result.auditPending?' Registro de auditoría pendiente.':''}`);renderProducts();
    }});
}

async function bulkProducts(active) {
  const ids = [...state.productSelected];
  if (!ids.length || state.busy) return;
  if (!perm('productos', 'accionesMasivas', 'editProducts') || !perm('productos', 'activarDesactivar', 'editProducts')) {
    toast('No tenés permiso para cambiar varios productos.');
    return;
  }
  if (ids.length > MAX_BULK_SELECTION) {
    toast(`Solo se pueden procesar ${MAX_BULK_SELECTION} productos por vez.`);
    return;
  }
  if(typeof window.TintinProductAdmin?.applyBulkChanges==='function')return editProductSelection(state.products.filter(p=>state.productSelected.has(p._docId)),{fields:['active'],initialField:'active',initialValue:active});
  setBusy(true);
  try {
    let changed = 0;
    for (const id of ids) {
      const product = state.products.find(p => p._docId === id);
      if (!product || (product.active !== false) === active) {
        state.productSelected.delete(id);
        continue;
      }
      if (typeof window.prodToggleActive !== 'function') throw new Error('La acción de producto todavía no está disponible.');
      const result = await window.prodToggleActive(id, product.active !== false);
      if (result?.status !== 'green') throw new Error(`No se confirmó el cambio de ${product.name || id}.`);
      state.productSelected.delete(id);
      changed += 1;
    }
    state.productSelected.clear();
    toast(changed ? `${changed} producto${changed === 1 ? '' : 's'} actualizado${changed === 1 ? '' : 's'}.` : 'No había productos que cambiar.');
  } catch (error) {
    console.error('[shopify-commerce] bulkProducts:', error);
    toast('No se pudieron actualizar todos los productos: ' + error.message, 5500);
  } finally {
    setBusy(false);
    renderProducts();
  }
}

async function bulkOrders(kind) {
  const ids = [...state.orderSelected].filter(id => state.orders.some(order => order.id === id && testOrderNumber(order) === null));
  if (!ids.length || state.busy) return;
  if (ids.length > MAX_BULK_SELECTION) {
    toast(`Solo se pueden procesar ${MAX_BULK_SELECTION} pedidos por vez.`);
    return;
  }
  setBusy(true);
  const isPay = kind === 'pagado';
  try {
    const fn = isPay ? window.updatePayStatus : window.updateOrderStatus;
    if (typeof fn !== 'function') throw new Error('La acción de pedidos todavía no está disponible.');
    if (navigator.onLine === false || state.ordersError || !state.ordersReady) throw new Error('Esperá a recuperar la sincronización.');
    let updated = 0;
    for (const id of ids) {
      const order = state.orders.find(item => item.id === id);
      if (!order || (!isPay && !allowedOrderStatuses(order).includes(kind))) continue;
      try {
        const result = await fn(id, kind, { baseChangeId: order.lastChangeId || '' });
        if (result === true) { updated++; state.orderSelected.delete(id); }
      } catch (error) { console.error('[orders] No se pudo actualizar un pedido seleccionado.', error?.message); }
    }
    toast(`${updated} de ${ids.length} pedidos actualizados.${state.orderSelected.size ? ' Los pendientes siguen seleccionados para revisión.' : ''}`);
  } catch (error) {
    console.error('[shopify-commerce] bulkOrders:', error);
    toast('No se pudieron actualizar todos los pedidos: ' + error.message, 5500);
  } finally {
    setBusy(false);
    renderOrders();
  }
}

function clickSection(section) {
  const nav = document.querySelector(`[data-section="${section}"]`);
  if (nav) nav.click();
}

function callLegacyAction(name, ...args) {
  const action = window[name];
  if (typeof action !== 'function') {
    toast('La acción todavía está cargando. Volvé a intentarlo en un momento.', 4500);
    return undefined;
  }
  return action(...args);
}

function openWhatsApp(order) {
  const customer = orderCustomer(order);
  const digits = String(customer.phone || '').replace(/\D/g, '');
  if (!digits) { toast('Este pedido no tiene teléfono.'); return; }
  const normalized = digits.startsWith('595') ? digits : `595${digits.replace(/^0+/, '')}`;
  const text = encodeURIComponent(`Hola ${customer.name || ''}! Te escribo por tu pedido #${orderDisplayId(order)} de Tintin.`);
  window.open(`https://wa.me/${normalized}?text=${text}`, '_blank', 'noopener,noreferrer');
}

async function handleAction(action, element) {
  const id = element?.dataset?.id || element?.dataset?.menuId || '';
  if (action === 'drawer-close') return closeDrawer();
  if (action === 'order-advance') return advanceOrder(id);
  if (action === 'order-contacts-retry') { state.orderContacts.delete(id); return refreshOrderContacts(id); }
  if (action === 'orders-toggle-tests') {
    if(state.role!=='superadmin') return;
    try { closeDrawer(); state.orderSelected.clear(); window.TintinAdminOrders.setTestVisibility(!state.includeTestOrders); }
    catch(error) { toast('No se pudo cambiar la vista: '+error.message); }
    return;
  }
  if (action === 'order-stage') { state.orderStage=element.dataset.stage;renderOrders();return; }
  if (action === 'order-show-more') { const key=element.dataset.stage;state.orderVisible[key]=(state.orderVisible[key] || 30)+30;return renderOrders(); }
  if (action === 'orders-sound') {
    state.orderSound=!state.orderSound;
    try { localStorage.setItem(`tt-order-sound:${state.user.uid}`,state.orderSound?'1':'0');
      if(state.orderSound) { const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)throw new Error('Sonido no disponible');orderAudio ||= new Audio();await orderAudio.resume();if(orderAudio.state !== 'running')throw new Error('Sonido bloqueado'); }
    } catch { state.orderSound=false;try{localStorage.setItem(`tt-order-sound:${state.user.uid}`,'0');}catch{}toast('El navegador no habilitó el sonido.'); }
    return renderOrders();
  }
  if (action === 'order-history-retry') { state.orderHistory.delete(id);return refreshOrderHistory(id); }

  if(action==='product-photo'){if(state.drawer?.type==='product'){state.drawer.imageIndex=Number(element.dataset.photoIndex)||0;renderDrawer();}return;}
  if(action==='work-more'){const pending=loadPrivateProductWorks(false,true);renderProducts();return pending;}
  if(action==='work-retry')return void loadPrivateProductWorks(true,Boolean(privateWorkNext));
  if(action==='work-show'){state.productTab='draft';state.productPage=0;return renderProducts();}
  if(action==='work-continue')return window.prodContinuarBorrador?.(element.dataset.key,element.dataset.productId || null);
  if(action==='products-metric'){state.productTab=element.dataset.productMetric;state.productPage=0;return renderProducts();}
  if(action==='product-duplicate'){
    if(!perm('productos','crear','addProducts'))return toast('No tenés permiso para duplicar productos.');
    closeDrawer();return callLegacyAction('prodDuplicar',id);
  }
  if(action==='products-bulk-edit'){
    if(!perm('productos','accionesMasivas','editProducts') || !perm('productos','editar','editProducts'))return toast('No tenés permiso para editar esta selección.');
    if(!state.productsReady || state.productsError || !state.user || navigator.onLine===false)return toast('Esperá a recuperar la sincronización del catálogo.');
    const products=state.products.filter(p=>state.productSelected.has(p._docId));if(!products.length)return;
    return editProductSelection(products,{fields:['price','pricePercent','priceBefore','stock','stockDelta','category','oferta','destacado','badge','tags',...(perm('productos','activarDesactivar','editProducts')?['active']:[])]});
  }
  if(action==='products-link-order' || action==='product-link-order'){
    if(state.role!=='superadmin' || !perm('pedidos','editar','editOrders'))return toast('No tenés permiso para editar compras de clientes.');
    if(!state.user || state.productsError || navigator.onLine===false)return toast('Esperá a recuperar la sincronización.');
    const products=state.products.filter(p=>action==='product-link-order'?p._docId===id:state.productSelected.has(p._docId));if(!products.length)return;
    closeDrawer();return openProductOrderLink({products,orders:state.orders.filter(order=>!order.localEntryId),onEdit:(orderId,options)=>{if(typeof window.TintinOrderAdmin?.openAdvancedOrderEditor!=='function')throw Error('El editor de pedidos todavía está cargando.');return window.TintinOrderAdmin.openAdvancedOrderEditor(orderId,options);}});
  }
  if (action === 'products-filters') {state.productFiltersOpen=!state.productFiltersOpen;return renderProducts();}
  if (action === 'products-bulk-panel') {state.productBulkOpen=!state.productBulkOpen;return renderProducts();}
  if (action === 'products-view-grid' || action === 'products-view-list') {state.productView=action==='products-view-list'?'list':'grid';return renderProducts();}
  if (action === 'products-reset-filters') {state.productSearch='';state.productTab='all';state.productCategory='';state.productStock='';state.productSort='name-asc';state.productPage=0;return renderProducts();}
  if (action === 'product-new') { closeDrawer(); return window.prodNuevo?.(); }
  if (action === 'products-import') return clickSection('importar');
  if (action === 'products-export') return exportProducts(false);
  if (action === 'products-export-selected') return exportProducts(true);
  if (action === 'products-clear-selection') { state.productSelected.clear();state.productBulkOpen=false;return renderProducts(); }
  if (action === 'products-page-prev') { state.productPage = Math.max(0, state.productPage - 1); return renderProducts(); }
  if (action === 'products-page-next') { state.productPage += 1; return renderProducts(); }
  if (action === 'products-bulk-activate') return bulkProducts(true);
  if (action === 'products-bulk-deactivate') return bulkProducts(false);
  if (action === 'products-bulk-delete') {
    if (typeof window.bulkDelete !== 'function') return toast('La eliminación masiva todavía no está disponible.');
    return window.bulkDelete([...state.productSelected]);
  }
  if (action === 'product-card-variant') { element.focus({preventScroll:true});state.cardVariants.set(id, element.dataset.variant); return renderProducts(); }
  if (action === 'product-card-cancel') {
    if(state.busy)return;
    state.cardDrafts.delete(id+'/'+element.dataset.variant);renderProducts();
    document.querySelector(`[data-card-stock="${CSS.escape(id)}"]`)?.focus({preventScroll:true});return;
  }
  if (action === 'product-card-save') {
    const input = element.closest('td')?.querySelector('[data-card-stock]');
    if (!input?.reportValidity() || input.value.trim()==='') return toast('Ingresá una cantidad entera, incluso 0 para marcar sin stock.');
    return saveProductCard(state.products.find(item=>item._docId===id), 'stock', input.value, element.dataset.variant);
  }
  if (action === 'product-edit' || action === 'drawer-product-edit') { closeDrawer(); return callLegacyAction('prodEditar', id); }
  if (action === 'product-toggle' || action === 'drawer-product-toggle') {
    const p = state.products.find(x => x._docId === id); if (!p) return;
    return window.prodToggleActive?.(id, p.active !== false);
  }
  if (action === 'product-delete' || action === 'drawer-product-delete') { closeDrawer(); return callLegacyAction('prodEliminar', id, state.products.find(p => p._docId === id)?.name || id); }
  if (action === 'drawer-product') return openDrawer('product', id, element);

  if (action === 'collection-new') { closeDrawer(); return window.collNueva?.(); }
  if (action === 'collections-export-selected') return exportCollections(true);
  if (action === 'collections-bulk-delete') {
    if (typeof window.bulkDeleteCollections !== 'function') return toast('La eliminación masiva todavía no está disponible.');
    return window.bulkDeleteCollections([...state.collectionSelected]);
  }
  if (action === 'collections-clear-selection') { state.collectionSelected.clear(); return renderCollections(); }
  if (action === 'collections-page-prev') { state.collectionPage = Math.max(0, state.collectionPage - 1); return renderCollections(); }
  if (action === 'collections-page-next') { state.collectionPage += 1; return renderCollections(); }
  if (action === 'collection-edit' || action === 'drawer-collection-edit') { closeDrawer(); return window.collEditar?.(id); }
  if (action === 'collection-products' || action === 'drawer-collection-products') {
    closeDrawer();
    state.productCategory = wristCategory(id);
    state.productSearch = '';
    state.productTab = 'all';
    state.productPage = 0;
    document.querySelector('[data-section="productos"]')?.click();
    return renderProducts();
  }
  if (action === 'collection-delete' || action === 'drawer-collection-delete') {
    const count = collectionProductCount(id); closeDrawer(); return window.collEliminar?.(id, count);
  }
  if (action === 'drawer-collection') return openDrawer('collection', id);

  if (action === 'orders-manual-new') return window.TintinOrderAdmin?.openManualOrder();
  if (action === 'orders-reset-sequence') return window.TintinOrderAdmin?.resetOrderSequence();
  if (action === 'orders-load-more') return loadMoreOrders();
  if (action === 'orders-page-prev') { state.orderPage = Math.max(0, state.orderPage - 1); return renderOrders(); }
  if (action === 'orders-page-next') {
    const loadedPages = Math.max(1, Math.ceil(filteredOrders().length / ADMIN_PAGE_SIZE));
    if (state.orderPage >= loadedPages - 1 && state.ordersHasMore) {
      state.orderPage += 1;
      return loadMoreOrders();
    }
    state.orderPage += 1;
    return renderOrders();
  }
  if (action === 'orders-retry') return window.TintinAdminOrders?.retry();
  if (action === 'products-retry' || action === 'collections-retry' || action === 'orders-retry') { commerceAuthRecoveryAttempted = false; return subscribeData(); }
  if (['order-edit-advanced','order-edit','drawer-order-edit','drawer-order-save','order-delete','drawer-order-delete','order-resend','drawer-order-resend'].includes(action)) {
    const local = state.orders.find(order => order.id === id)?.localEntryId;
    if (local) { closeDrawer(); window.dispatchEvent(new CustomEvent('tintin:edit-local-sale', { detail: local })); return; }
  }
  if (action === 'order-edit-advanced') { closeDrawer(); return window.TintinOrderAdmin?.openAdvancedOrderEditor(id); }
  if (action === 'order-restore') return window.TintinOrderAdmin?.restoreOrder(id).then(() => toast('Pedido restaurado en estado Cancelado; podés reactivarlo desde CRUD completo.'));
  if (action === 'order-delete-permanent') return window.TintinOrderAdmin?.deleteTrashPermanently(id);
  if (action === 'orders-export') return exportOrders(false);
  if (action === 'orders-export-selected') return exportOrders(true);
  if (action === 'orders-clear-selection') { state.orderSelected.clear(); return renderOrders(); }
  if (action === 'orders-bulk-preparing') return bulkOrders('preparando');
  if (action === 'orders-bulk-way') return bulkOrders('en_camino');
  if (action === 'orders-bulk-delivered') return bulkOrders('entregado');
  if (action === 'orders-bulk-paid') return bulkOrders('pagado');
  if (action === 'order-edit' || action === 'drawer-order-edit') { closeDrawer(); return window.openOrderEdit?.(id); }
  if (action === 'drawer-order-save') return saveDrawerOrder(id);
  if (action === 'order-resend' || action === 'drawer-order-resend') return window.resendOrderEmail?.(id);
  if (action === 'order-delete' || action === 'drawer-order-delete') { closeDrawer(); return window.deleteOrder?.(id); }
  if (action === 'drawer-order-whatsapp') { const order = state.orders.find(o => o.id === id); if (order) return openWhatsApp(order); }
  if (action === 'drawer-order') return openDrawer('order', id);
}

function onClick(event) {
  const stop = event.target.closest('[data-stop]');
  if (stop && !event.target.closest('[data-action], [data-menu], [data-menu-action]')) event.stopPropagation();

  const menuButton = event.target.closest('[data-menu]');
  if (menuButton) {
    event.preventDefault(); event.stopPropagation();
    return openMenu(menuButton, menuButton.dataset.menu, menuButton.dataset.id);
  }

  const menuAction = event.target.closest('[data-menu-action]');
  if (menuAction) {
    event.preventDefault(); event.stopPropagation();
    closeMenu();
    return handleAction(menuAction.dataset.menuAction, menuAction);
  }

  const action = event.target.closest('[data-action]');
  if (action) {
    event.preventDefault();
    return handleAction(action.dataset.action, action);
  }

  const tab = event.target.closest('[data-tab-module]');
  if (tab) {
    const module = tab.dataset.tabModule;
    if (module === 'products') { state.productTab = tab.dataset.tab; renderProducts(); }
    if (module === 'collections') { state.collectionTab = tab.dataset.tab; state.collectionSelected.clear(); renderCollections(); }
    if (module === 'orders') {
      state.orderTab = tab.dataset.tab;
      state.orderSelected.clear();
      if (state.orderTab === 'deleted') ensureTrashSubscription();
      renderOrders();
    }
    return;
  }

  const row = event.target.closest('tr[data-open]');
  if (row && !event.target.closest('input,button,select,a,[data-stop]')) openDrawer(row.dataset.open, row.dataset.id);
}

function onChange(event) {
  const target = event.target;
  if (target.matches('[data-card-variant]')) { state.cardVariants.set(target.dataset.cardVariant, target.value); return renderProducts(); }
  if (target.matches('[data-card-category]')) return saveProductCard(state.products.find(item=>item._docId===target.dataset.cardCategory), 'category', target.value);
  if (target.matches('[data-collection-visible]')) return saveCollectionVisibility(target);
  if (target.matches('[data-card-active]')) return saveProductCard(state.products.find(item=>item._docId===target.dataset.cardActive), 'active', target.value==='true');
  if (target.matches('[data-select-product]')) {
    const id = target.dataset.selectProduct;
    addToLimitedSelection(state.productSelected, id, target.checked);
    target.checked = state.productSelected.has(id);
    return renderProducts();
  }
  if (target.matches('[data-select-collection]')) {
    const id = target.dataset.selectCollection;
    addToLimitedSelection(state.collectionSelected, id, target.checked);
    target.checked = state.collectionSelected.has(id);
    return renderCollections();
  }
  if (target.matches('[data-select-order]')) {
    const id = target.dataset.selectOrder;
    if(!state.orders.some(order=>order.id===id && testOrderNumber(order)===null)){target.checked=false;return;}
    addToLimitedSelection(state.orderSelected, id, target.checked);
    target.checked = state.orderSelected.has(id);
    return renderOrders();
  }
  if (target.matches('[data-check-all="products"]')) {
    const page = pageSlice(filteredProducts(), state.productPage);
    selectPageOnly(state.productSelected, page.items.map(p => p._docId), target.checked);
    return renderProducts();
  }
  if (target.matches('[data-check-all="collections"]')) {
    const page = pageSlice(filteredCollections(), state.collectionPage);
    selectPageOnly(state.collectionSelected, page.items.map(c => c.slug), target.checked);
    return renderCollections();
  }
  if (target.matches('[data-check-all="orders"]')) {
    const page = pageSlice(filteredOrders(), state.orderPage);
    selectPageOnly(state.orderSelected, page.items.map(o => o.id), target.checked);
    return renderOrders();
  }

  const filter = target.dataset.filter;
  if (filter === 'product-status') {state.productTab=target.value;state.productPage=0;return renderProducts();}
  if (filter === 'product-category') { state.productCategory = target.value; state.productPage = 0; return renderProducts(); }
  if (filter === 'product-stock') { state.productStock = target.value; state.productPage = 0; return renderProducts(); }
  if (filter === 'product-sort') { state.productSort = target.value; state.productPage = 0; return renderProducts(); }
  if (filter === 'collection-visibility') { state.collectionVisibility = target.value; state.collectionPage = 0; return renderCollections(); }
  if (filter === 'collection-sort') { state.collectionSort = target.value; state.collectionPage = 0; return renderCollections(); }
  if (filter === 'order-status') { state.orderStatus = target.value; state.orderPage = 0; return renderOrders(); }
  if (filter === 'order-delivery') { state.orderDelivery=target.value;return renderOrders(); }
  if (filter === 'order-pay') { state.orderPay = target.value; state.orderPage = 0; return renderOrders(); }
  if (filter === 'order-sort') { state.orderSort = target.value; state.orderPage = 0; return renderOrders(); }

  if (target.matches('[data-drawer-order-status]')) {
    const id = target.dataset.drawerOrderStatus;
    if (state.drawer?.type === 'order' && state.drawer.id === id) {
      state.drawer.pending = { ...(state.drawer.pending || {}), status: target.value };
      return renderDrawer();
    }
  }
  if (target.matches('[data-drawer-order-pay]')) {
    const id = target.dataset.drawerOrderPay;
    if (state.drawer?.type === 'order' && state.drawer.id === id) {
      state.drawer.pending = { ...(state.drawer.pending || {}), payment: target.value };
      return renderDrawer();
    }
  }
}

const searchTimers = new Map();
function onInput(event) {
  if (event.target.matches('[data-card-stock]')) {
    const input=event.target, product=state.products.find(item=>item._docId===input.dataset.cardStock);
    if (!product) return;
    if(input.dataset.variant)state.cardVariants.set(product._docId,input.dataset.variant);
    const cancel=input.closest('td')?.querySelector('[data-action="product-card-cancel"]');if(cancel)cancel.hidden=false;
    const key=product._docId+'/'+input.dataset.variant;
    state.cardDrafts.set(key,{value:input.value,expected:state.cardDrafts.get(key)?.expected || productFingerprint(product)});
    return;
  }
  if(event.target.matches('[data-drawer-order-note]') && state.drawer?.type==='order') { state.drawer.pending={...(state.drawer.pending || {}),statusNote:event.target.value};const save=document.querySelector('[data-action="drawer-order-save"]');if(save)save.disabled=!drawerOrderHasPending(state.drawer.id);return; }
  const filter = event.target.dataset.filter;
  if (!['product-search', 'collection-search', 'order-search'].includes(filter)) return;
  clearTimeout(searchTimers.get(filter));
  const value = event.target.value;
  // El dato se actualiza al escribir, antes de snapshots remotos o renders de
  // otros filtros. El debounce sólo difiere el trabajo de la lista.
  if (filter === 'product-search') { state.productSearch = value; state.productPage = 0; }
  if (filter === 'collection-search') { state.collectionSearch = value; state.collectionPage = 0; }
  if (filter === 'order-search') { state.orderSearch = value; state.orderPage = 0; }
  if (event.isComposing) return;
  searchTimers.set(filter, setTimeout(() => {
    searchTimers.delete(filter);
    if (filter === 'product-search') renderProducts();
    if (filter === 'collection-search') renderCollections();
    if (filter === 'order-search') renderOrders();
  }, 120));
}

function mountShells() {
  const definitions = [
    ['productos', 'tt-commerce-products'],
    ['colecciones', 'tt-commerce-collections'],
    ['pedidos', 'tt-commerce-orders']
  ];
  definitions.forEach(([sectionKey, rootId]) => {
    const section = document.getElementById(`section-${sectionKey}`);
    if (!section || document.getElementById(rootId)) return;
    const shell = document.createElement('div');
    shell.id = rootId;
    shell.className = 'tt-commerce-shell';
    section.prepend(shell);
  });
  installProductInterface();
  syncLegacyFormVisibility();
  renderAll();
  // El listado original sigue disponible si falla el montaje de su reemplazo.
  // La transición se confirma sólo cuando todas las vistas ya tienen contenido.
  definitions.forEach(([sectionKey, rootId]) => {
    if (!document.getElementById(rootId)?.childElementCount) return;
    document.getElementById(`section-${sectionKey}`)?.classList.add('tt-commerce-mounted');
    if (sectionKey === 'pedidos') document.getElementById('orders-tbody')?.replaceChildren();
  });
}

function visible(el) {
  if (!el) return false;
  return getComputedStyle(el).display !== 'none' && !el.hidden;
}

function syncLegacyFormVisibility() {
  syncProductSurfaces();
  const productShell = document.getElementById('tt-commerce-products');
  if (productShell) productShell.hidden = visible(document.getElementById('prod-form-card'));

  const collectionShell = document.getElementById('tt-commerce-collections');
  if (collectionShell) {
    collectionShell.hidden = [
      document.getElementById('coll-form-card'),
      document.getElementById('coll-products-card'),
      document.getElementById('coll-picker-card')
    ].some(visible);
  }
}

function observeLegacyForms() {
  const targets = ['prod-form-card', 'coll-form-card', 'coll-products-card', 'coll-picker-card']
    .map(id => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;
  const observer = new MutationObserver(syncLegacyFormVisibility);
  targets.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['style', 'hidden', 'class'] }));
}

function recoverCommerceAuth(error, source) {
  const code = listenerErrorCode(error);
  const authRelated = code === 'permission-denied' || code === 'unauthenticated';
  recordAuthDiagnostic('FIRESTORE_LISTENER_ERROR', {
    source: `admin-commerce-${source}`,
    firestoreCode: code,
    recovery: authRelated ? 'refresh-once' : 'manual-retry',
  });
  if (!authRelated || commerceAuthRecoveryAttempted || !state.user) return;

  commerceAuthRecoveryAttempted = true;
  const targetUser = state.user;
  if (!commerceAuthRecoveryPromise) {
    commerceAuthRecoveryPromise = targetUser.getIdToken(true)
      .then(() => waitForAdminAppCheck(12000))
      .then(Boolean)
      .catch(refreshError => {
        recordAuthDiagnostic('FIRESTORE_LISTENER_AUTH_REFRESH_FAILED', {
          source: 'admin-commerce',
          firestoreCode: listenerErrorCode(refreshError),
        });
        return false;
      })
      .finally(() => { commerceAuthRecoveryPromise = null; });
  }
  void commerceAuthRecoveryPromise.then(ok => {
    if (ok && state.user?.uid === targetUser.uid) subscribeData();
  });
}

function subscribeProductCatalog(onData, onError, onLoading) {
  return createAdminPagedSource({
    complete: state.role === 'superadmin', onData, onError, onLoading,
    subscribePage(cursor, next, fail) {
      const base = collection(db, 'products');
      const source = cursor
        ? query(base, orderBy('__name__'), startAfter(cursor), limit(1000))
        : query(base, orderBy('__name__'), limit(1000));
      return onSnapshot(source, { includeMetadataChanges: true }, snapshot => {
        const last = snapshot.docs.at(-1);
        next({ records: snapshot.docs.map(item => ({ id: item.id, record: item.data() })),
          cursor: last, cursorKey: last?.id || '', hasMore: snapshot.docs.length === 1000,
          authoritative: snapshot.metadata?.fromCache !== true });
      }, fail);
    },
  }).stop;
}

function subscribeData() {
  state.unsubscribers.forEach(unsub => { try { unsub(); } catch {} });
  state.unsubscribers = [];
  if (state.trashUnsubscribe) {
    try { state.trashUnsubscribe(); } catch {}
    state.trashUnsubscribe = null;
  }

  state.productsError = '';
  state.collectionsError = '';
  state.productsReady = false;
  state.collectionsReady = false;
  state.ordersReady = false;
  const productOwnerUid = state.user?.uid;
  state.unsubscribers.push(subscribeProductCatalog(records => {
    if (state.user?.uid !== productOwnerUid) return;
    state.products = records.map(item => ({ _docId: item.id, ...item.record }));
    state.productsReady = true;
    state.productsError = '';
    state.productSelected = new Set([...state.productSelected].filter(id => state.products.some(p => p._docId === id)));
    renderProducts(); renderCollections(); renderDrawer();
  }, error => {
    state.productsReady = true;
    state.productsError = 'No se pudieron cargar los productos. El total no está disponible.';
    console.error('[shopify-commerce] products:', error);
    toast('No se pudieron actualizar los productos en tiempo real.', 5000);
    recoverCommerceAuth(error, 'products');
    renderProducts();
  }, () => { state.productsReady = false; }));

  // Firestore rules require a bounded list for non-superadmin roles.
  state.unsubscribers.push(onSnapshot(query(collection(db, 'collections'), limit(200)), snapshot => {
    state.collections = unifyWristCollections(snapshot.docs.map(snap => normalizeCollectionDoc(snap.id, snap.data())).filter(Boolean));
    state.collectionsReady = true;
    state.collectionsError = '';
    state.collectionSelected = new Set([...state.collectionSelected].filter(slug => state.collections.some(c => c.slug === slug)));
    renderCollections(); renderProducts(); renderDrawer();
  }, error => {
    state.collectionsReady = true;
    state.collectionsError = 'No se pudieron cargar las colecciones. El total no está disponible.';
    console.error('[shopify-commerce] collections:', error);
    toast('No se pudieron actualizar las colecciones en tiempo real.', 5000);
    recoverCommerceAuth(error, 'collections');
    renderCollections();
  }));

  bindCanonicalOrders();

  state.trashOrders = [];
  state.trashReady = state.role !== 'superadmin';
  if (state.orderTab === 'deleted') ensureTrashSubscription();
}

let orderSourceStop = null;
let orderSourceUid = '';
let orderSourcePrimed = false;
let orderSeenIds = new Set();
let orderAudio = null;
let orderReturnFocus = null;
function bindCanonicalOrders() {
  if (!state.user || !window.TintinAdminOrders?.subscribe) return;
  if (orderSourceStop && orderSourceUid === state.user.uid) return;
  orderSourceStop?.(); orderSourceUid = state.user.uid;
  orderSourcePrimed = false; orderSeenIds = new Set();
  try { state.orderSound = localStorage.getItem(`tt-order-sound:${orderSourceUid}`) === '1'; } catch {}
  const expectedUid=orderSourceUid;
  orderSourceStop=window.TintinAdminOrders.subscribe(snapshot => {
    if (state.user?.uid !== expectedUid || snapshot.uid !== expectedUid) return;
    const fresh = orderSourcePrimed && snapshot.ready ? ordersForView(snapshot.orders).filter(o=>!orderSeenIds.has(o.id) && !o.localEntryId && (orderStage(o)==='new' || o.status==='confirmado')) : [];
    if (snapshot.ready) {
      for(const order of snapshot.orders) orderSeenIds.add(order.id);
      orderSourcePrimed=true;
    }
    state.includeTestOrders=snapshot.includeTestOrders===true;
    state.orders=ordersForView(snapshot.orders,state.includeTestOrders); state.ordersReady=snapshot.ready; state.ordersError=snapshot.error || '';
    state.ordersHasMore=false;
    state.orderSelected=new Set([...state.orderSelected].filter(id=>state.orders.some(o=>o.id===id && testOrderNumber(o)===null)));
    window.dispatchEvent(new Event('tintin:orders-updated'));
    if(state.drawer?.type==='order' && !state.orders.some(order=>order.id===state.drawer.id)) closeDrawer();
    renderOrders(); if (state.drawer?.type==='order') { refreshOrderHistory(state.drawer.id); refreshOrderContacts(state.drawer.id); renderDrawer(); }
    if (fresh.length && document.getElementById('section-pedidos')?.classList.contains('active')) {
      const notice=document.querySelector('[data-order-notice]');
      if (notice) { notice.hidden=false; const order=fresh[0];notice.replaceChildren();
        const text=document.createElement('span');text.textContent=`${fresh.length} pedido(s) nuevo(s). `;notice.append(text);
        const btn=document.createElement('button');btn.type='button';btn.className='tt-commerce-btn';btn.dataset.action='drawer-order';btn.dataset.id=order.id;btn.textContent='Abrir pedido';notice.append(btn); }
      if (state.orderSound && orderAudio?.state === 'running') { const oscillator=orderAudio.createOscillator(), gain=orderAudio.createGain(); oscillator.frequency.value=660;gain.gain.value=.035;oscillator.connect(gain);gain.connect(orderAudio.destination);oscillator.start();oscillator.stop(orderAudio.currentTime+.12); }
    }
  });
}
async function loadMoreOrders() { state.orderVisible[state.orderStage]=(state.orderVisible[state.orderStage] || 30)+30; renderOrders(); }
async function refreshOrderContacts(id) {
  if(state.role !== 'superadmin') return;
  const order=state.orders.find(o=>o.id===id), revision=order?.lastChangeId || String(order?.inventoryRevision || 0);
  if(state.orderContacts.get(id)?.revision===revision) return;
  const uid=state.user?.uid;state.orderContacts.set(id,{revision,loading:true});
  try {
    const response=await authenticatedFetch(`/api/admin-order-mutation?orderId=${encodeURIComponent(id)}`);
    const body=await response.json();
    if(!response.ok || !body.ok)throw new Error('No se pudieron consultar los contactos.');
    if(state.user?.uid===uid && state.orderContacts.get(id)?.revision===revision)state.orderContacts.set(id,{revision,links:body.links});
  } catch { if(state.user?.uid===uid && state.orderContacts.get(id)?.revision===revision)state.orderContacts.set(id,{revision,error:true}); }
  if(state.drawer?.type==='order' && state.drawer.id===id)renderDrawer();
}
async function advanceOrder(id, requested = '') {
  const order=state.orders.find(o=>o.id===id);
  if (!order || state.orderBusyIds.has(id) || navigator.onLine === false || state.ordersError || !state.ordersReady) return;
  const next=requested || nextOrderStatus(order);
  if (!next || !allowedOrderStatuses(order).includes(next)) return toast('Este cambio no corresponde a la etapa actual.');
  state.orderBusyIds.add(id);renderOrders();
  try {
    const ok=await window.updateOrderStatus?.(id,next,{baseChangeId:order.lastChangeId || '',changeId:`board_${crypto.randomUUID().replaceAll('-','')}`});
    if (ok !== true) throw new Error('No se pudo confirmar el cambio. Revisá el estado sincronizado antes de reintentar.');
  } catch(error) { toast(error.message || 'No se pudo actualizar el pedido.',5200); }
  finally { state.orderBusyIds.delete(id);renderOrders();if(state.drawer?.type==='order')renderDrawer(); }
}
async function refreshOrderHistory(id) {
  if(state.role !== 'superadmin') return;
  const order=state.orders.find(o=>o.id===id), revision=order?.lastChangeId || String(order?.inventoryRevision || 0);
  const cached=state.orderHistory.get(id);
  if(cached?.revision===revision) return;
  const uid=state.user?.uid;
  state.orderHistory.set(id,{revision,loading:true,items:cached?.items || []});
  try {
    const snap=await getDocs(query(collection(db,'auditLog'),where('entityId','==',id)));
    if(state.user?.uid !== uid || state.orderHistory.get(id)?.revision!==revision) return;
    const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>timestampMillis(a.createdAt || a.timestamp)-timestampMillis(b.createdAt || b.timestamp));
    state.orderHistory.set(id,{revision,items,loading:false});
  } catch(error) { if(state.user?.uid===uid && state.orderHistory.get(id)?.revision===revision)state.orderHistory.set(id,{revision,items:cached?.items || [],error:'No se pudo consultar el historial. Reintentá al recuperar la conexión.'}); }
  if(state.drawer?.type==='order' && state.drawer.id===id)renderDrawer();
}

function ensureTrashSubscription() {
  if (state.role !== 'superadmin' || state.trashUnsubscribe) return;
  state.trashReady = false;
  state.trashUnsubscribe = onSnapshot(collection(db, 'orderTrash'), snapshot => {
    state.trashOrders = snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }));
    state.trashReady = true;
    renderOrders();
  }, error => {
    state.trashReady = true;
    console.error('[shopify-commerce] orderTrash:', error);
    try { state.trashUnsubscribe?.(); } catch {}
    state.trashUnsubscribe = null;
    const ordersVisible = document.getElementById('section-pedidos')?.classList.contains('active');
    if (ordersVisible && state.orderTab === 'deleted') {
      toast('No se pudo actualizar la sección Borrados.', 5000);
    }
    renderOrders();
  });
}

async function bootForUser(user) {
  if (!user || user.isAnonymous) return;
  if(state.user?.uid !== user.uid) {state.cardDrafts.clear();state.cardVariants.clear();}
  if(state.user?.uid !== user.uid) {closeProductMasterDialogs(); orderSourceStop?.();orderSourceStop=null;state.orders=[];state.ordersReady=false;state.orderContacts.clear();state.orderHistory.clear();if(state.drawer?.type==='order')closeDrawer(); }
  state.user = user;
  try { const ui=JSON.parse(sessionStorage.getItem(`tt-orders-ui:${user.uid}`) || '{}');
    if(['all','attention','history','buyers','deleted'].includes(ui.tab))state.orderTab=ui.tab;
    if(['new','preparing','ready','sent','done'].includes(ui.stage))state.orderStage=ui.stage;
    state.orderSearch=String(ui.search || '');state.orderPay=String(ui.pay || '');state.orderDelivery=String(ui.delivery || '');state.orderSort=ui.sort==='date-asc'?'date-asc':'date-desc';
  } catch {}

  commerceAuthRecoveryAttempted = false;
  await loadRolePermissions();
  state.role = await getUserRole(user.uid, user.email);
  state.ready = true;
  mountShells();
  observeLegacyForms();
  if (!await waitForAdminAppCheck(12000)) return;
  subscribeData();
}

function boot() {
  ensureCss();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('compositionend', onInput);
  document.addEventListener('click', event => {
    if (!event.target.closest('#tt-commerce-menu,[data-menu]')) closeMenu();
  }, true);
  window.addEventListener('resize', closeMenu, { passive: true });
  window.addEventListener('scroll', closeMenu, { passive: true, capture: true });
  window.addEventListener('tintin:catalog-mutated', event => {
    const detail = event.detail || {};
    const result = detail.result || {};
    const deletedIds = detail.type === 'products'
      ? result.productIds
      : result.productMode === 'delete'
        ? result.productPurge?.productIds
        : [];
    if (Array.isArray(deletedIds) && deletedIds.length) {
      const deleted = new Set(deletedIds.map(id => String(id || '')).filter(Boolean));
      state.products = state.products.filter(product => !deleted.has(String(product?._docId || '')));
      state.productsReady = true;
      state.productsError = '';
    }
    state.productSelected.clear();
    state.collectionSelected.clear();
    renderProducts();
    renderCollections();
    renderDrawer();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.querySelector('#unsaved-modal[aria-hidden="false"],dialog[open]')) return;
      const picker=document.querySelector('.tt-mlib-overlay');
      if(visibleProductEditor() && picker){event.preventDefault();picker.querySelector('.tt-mlib-close')?.click();return;}
      const editor=visibleProductEditor();
      if(editor){event.preventDefault();window.prodCancelForm?.();return;}
      closeMenu();closeDrawer();
    }
  });

  document.addEventListener('keydown',event=>{
    if((state.drawer?.type==='order' || state.drawer?.type==='product' || visibleProductEditor()) && event.key==='Tab') {
      if (document.querySelector('#unsaved-modal[aria-hidden="false"],dialog[open]')) return;
      const drawer=(visibleProductEditor() && document.querySelector('.tt-mlib-overlay')) || visibleProductEditor() || document.getElementById('tt-commerce-drawer');
      const controls=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(e=>e.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && (document.activeElement===first || !drawer.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && (document.activeElement===last || !drawer.contains(document.activeElement))){event.preventDefault();first?.focus();}
    }
    const tab=event.target.closest('[data-action="order-stage"]');
    if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();const keys=['new','preparing','ready','sent','done'];const current=keys.indexOf(state.orderStage);
      state.orderStage=keys[event.key==='Home'?0:event.key==='End'?4:(current+(event.key==='ArrowRight'?1:4))%5];renderOrders();document.querySelector(`[data-stage="${state.orderStage}"][data-action="order-stage"]`)?.focus();
    }
  });
  window.addEventListener('tintin:admin-orders-source',bindCanonicalOrders);
  window.addEventListener('online',()=>{ window.TintinAdminOrders?.retry();renderOrders(); });
  window.addEventListener('offline',renderOrders);
  setInterval(()=>{if(document.getElementById('section-pedidos')?.classList.contains('active'))renderOrders();},60000);
  subscribeAuthState(user => {
    if (user && !user.isAnonymous) {
      bootForUser(user).catch(error => {
        console.error('[shopify-commerce] No se pudo iniciar:', error);
        toast('No se pudo iniciar la vista avanzada de comercio.', 5200);
      });
      return;
    }
    // Sin esto, los listeners de products/collections/orders/orderTrash
    // seguían corriendo tras una pérdida real de sesión y cada uno chocaba
    // por separado con "Missing or insufficient permissions" en Firestore.
    for (const timer of searchTimers.values()) clearTimeout(timer);
    searchTimers.clear();
    state.unsubscribers.forEach(unsub => { try { unsub(); } catch {} });
    state.unsubscribers = [];
    orderSourceStop?.();orderSourceStop=null;orderSourceUid='';state.orders=[];state.orderHistory.clear();state.orderContacts.clear();state.drawer=null;renderOrders();renderDrawer();
    closeProductMasterDialogs();
    state.cardDrafts.clear();state.cardVariants.clear();
    state.user = null;
    commerceAuthRecoveryAttempted = false;
    if (state.trashUnsubscribe) { try { state.trashUnsubscribe(); } catch {} state.trashUnsubscribe = null; }
  });
}

if (!window.TintinShopifyCommerceAdminBooted) {
  window.TintinShopifyCommerceAdminBooted = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
