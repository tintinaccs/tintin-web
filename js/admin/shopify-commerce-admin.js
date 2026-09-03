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

import { auth, db } from '../core/firebase/firebase.js?v=tintin-20260903-auth-persistence-1';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { can, getUserRole } from '../core/auth/roles.js?v=tintin-20260821-accounts-phase-a-1';
import { canDo, loadRolePermissions } from '../core/auth/permisos-roles.js?v=tintin-20260821-accounts-phase-a-1';
import { normalizeCollectionDoc } from '../pages/collections/estado-colecciones.js?v=tintin-20260901-firestore-budget-1';
import { sanitizeImageUrl } from '../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';

const VERSION = 'tintin-20260825-orders-ops-1';
const CSS_HREF = `css/admin/shopify-commerce-admin.css?v=${VERSION}`;

const ORDER_STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  preparando: 'En preparación',
  listo_retiro: 'Listo para retirar',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  rechazado: 'Rechazado',
  enviado: 'En camino'
};
const ORDER_STATUS_VALUES = ['pendiente', 'confirmado', 'preparando', 'listo_retiro', 'en_camino', 'entregado', 'cancelado', 'rechazado'];
const PAY_STATUS_LABELS = {
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
  trashReady: false,
  products: [],
  collections: [],
  orders: [],
  trashOrders: [],
  productTab: 'all',
  collectionTab: 'all',
  orderTab: 'all',
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
  productSelected: new Set(),
  collectionSelected: new Set(),
  orderSelected: new Set(),
  drawer: null,
  busy: false,
  unsubscribers: [],
  trashUnsubscribe: null
};

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
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
    product?.image,
    product?.imageUrl,
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

function productStatus(product) {
  if (product?.active === false) return { key: 'inactive', label: 'Inactivo', cls: 'neutral' };
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
  return String(order?.orderNumber || order?.shortId || order?.id || '—');
}

function productVariantsCount(product) {
  if (Array.isArray(product?.variants)) return product.variants.length;
  if (product?.variants && typeof product.variants === 'object') return Object.keys(product.variants).length;
  return 0;
}

function collectionProductCount(slug) {
  return state.products.filter(product => String(product?.category || '') === String(slug || '')).length;
}

function productTabCounts() {
  return {
    all: state.products.length,
    active: state.products.filter(p => productStatus(p).key === 'active').length,
    inactive: state.products.filter(p => p?.active === false).length,
    soldout: state.products.filter(p => p?.active !== false && p?.stock != null && Number(p.stock) <= 0).length,
    sale: state.products.filter(p => p?.oferta === true || (Number(p?.priceBefore) > Number(p?.price) && Number(p?.price) >= 0)).length,
    featured: state.products.filter(p => p?.destacado === true).length
  };
}

function orderTabCounts() {
  return { all: state.orders.length, unpaid: state.orders.filter(o => payStatus(o) !== 'pagado').length, unfulfilled: state.orders.filter(o => !['entregado', 'cancelado', 'rechazado'].includes(orderStatus(o))).length, delivered: state.orders.filter(o => orderStatus(o) === 'entregado').length, canceled: state.orders.filter(o => ['cancelado', 'rechazado'].includes(orderStatus(o))).length, refunded: state.orders.filter(o => payStatus(o) === 'reembolsado').length, deleted: state.trashOrders.length };
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
    list = list.filter(p => [p?.name, p?.category, p?._docId, p?.sku].some(v => normalizeText(v).includes(q)));
  }
  if (state.productTab === 'active') list = list.filter(p => productStatus(p).key === 'active');
  if (state.productTab === 'inactive') list = list.filter(p => p?.active === false);
  if (state.productTab === 'soldout') list = list.filter(p => p?.active !== false && p?.stock != null && Number(p.stock) <= 0);
  if (state.productTab === 'sale') list = list.filter(p => p?.oferta === true || Number(p?.priceBefore) > Number(p?.price));
  if (state.productTab === 'featured') list = list.filter(p => p?.destacado === true);
  if (state.productCategory) list = list.filter(p => String(p?.category || '') === state.productCategory);
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
  let list = state.orderTab === 'deleted' ? [...state.trashOrders] : [...state.orders];
  const q = normalizeText(state.orderSearch);
  if (q) list = list.filter(order => { const customer = orderCustomer(order); const items = orderItems(order).map(item => item?.name || item?.title || '').join(' '); return [orderDisplayId(order), order?.id, customer.name, customer.email, customer.phone, items].some(v => normalizeText(v).includes(q)); });
  if (state.orderTab === 'unpaid') list = list.filter(o => payStatus(o) !== 'pagado');
  if (state.orderTab === 'unfulfilled') list = list.filter(o => !['entregado', 'cancelado', 'rechazado'].includes(orderStatus(o)));
  if (state.orderTab === 'delivered') list = list.filter(o => orderStatus(o) === 'entregado');
  if (state.orderTab === 'canceled') list = list.filter(o => ['cancelado', 'rechazado'].includes(orderStatus(o)));
  if (state.orderTab === 'refunded') list = list.filter(o => payStatus(o) === 'reembolsado');
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
  const unfulfilled = active.filter(order => !['entregado'].includes(orderStatus(order))).length;
  const delivered = state.orders.filter(order => orderStatus(order) === 'entregado').length;
  const items = todayOrders.reduce((sum, order) => sum + orderItems(order).reduce((qty, item) => qty + Number(item?.qty ?? item?.quantity ?? 1), 0), 0);
  return { today: todayOrders.length, revenue, pending, unfulfilled, delivered, items };
}

function tabButton(module, key, label, count, activeKey) {
  return `<button type="button" class="tt-commerce-tab${activeKey === key ? ' active' : ''}" data-tab-module="${module}" data-tab="${key}">${esc(label)}<span class="n">${count}</span></button>`;
}

function renderProducts() {
  const root = document.getElementById('tt-commerce-products');
  if (!root) return;
  const counts = productTabCounts();
  const list = filteredProducts();
  const selectedVisible = list.filter(p => state.productSelected.has(p._docId)).length;
  const allVisibleSelected = list.length > 0 && selectedVisible === list.length;
  const canCreate = perm('productos', 'crear', 'addProducts');
  const canEdit = perm('productos', 'editar', 'editProducts');
  const canToggle = perm('productos', 'activarDesactivar', 'editProducts');
  const canDelete = perm('productos', 'eliminar', 'deleteProducts');
  const canBulk = perm('productos', 'accionesMasivas', 'editProducts');
  const canExport = perm('productos', 'exportar', 'editProducts') || state.role === 'viewer';

  root.innerHTML = `
    <div class="tt-commerce-pagehead">
      <div class="tt-commerce-titlegroup">
        <h1 class="tt-commerce-title">Productos <span class="tt-commerce-count">${state.products.length}</span></h1>
        <div class="tt-commerce-subtitle">Catálogo conectado en tiempo real con la tienda.</div>
      </div>
      <div class="tt-commerce-actions">
        ${canExport ? button('Exportar', 'products-export') : ''}
        ${state.role === 'superadmin' ? button('Importar', 'products-import') : ''}
        ${canCreate ? button('Agregar producto', 'product-new', { primary: true }) : ''}
      </div>
    </div>
    <div class="tt-commerce-card">
      <div class="tt-commerce-tabs">
        ${tabButton('products', 'all', 'Todos', counts.all, state.productTab)}
        ${tabButton('products', 'active', 'Activos', counts.active, state.productTab)}
        ${tabButton('products', 'inactive', 'Inactivos', counts.inactive, state.productTab)}
        ${tabButton('products', 'soldout', 'Agotados', counts.soldout, state.productTab)}
        ${tabButton('products', 'sale', 'En oferta', counts.sale, state.productTab)}
        ${tabButton('products', 'featured', 'Destacados', counts.featured, state.productTab)}
      </div>
      <div class="tt-commerce-toolbar">
        <label class="tt-commerce-search"><input class="tt-commerce-input" data-filter="product-search" type="search" value="${esc(state.productSearch)}" placeholder="Buscar productos"></label>
        <select class="tt-commerce-select" data-filter="product-category" aria-label="Filtrar por colección">
          <option value="">Todas las colecciones</option>
          ${state.collections.map(c => `<option value="${esc(c.slug)}" ${state.productCategory === c.slug ? 'selected' : ''}>${esc(c.name || c.slug)}</option>`).join('')}
        </select>
        <select class="tt-commerce-select" data-filter="product-stock" aria-label="Filtrar por inventario">
          <option value="">Todo el inventario</option>
          <option value="in" ${state.productStock === 'in' ? 'selected' : ''}>Con stock</option>
          <option value="out" ${state.productStock === 'out' ? 'selected' : ''}>Agotados</option>
          <option value="unlimited" ${state.productStock === 'unlimited' ? 'selected' : ''}>Sin control de stock</option>
        </select>
        <select class="tt-commerce-select" data-filter="product-sort" aria-label="Ordenar productos">
          <option value="name-asc" ${state.productSort === 'name-asc' ? 'selected' : ''}>Nombre A–Z</option>
          <option value="name-desc" ${state.productSort === 'name-desc' ? 'selected' : ''}>Nombre Z–A</option>
          <option value="price-desc" ${state.productSort === 'price-desc' ? 'selected' : ''}>Precio mayor</option>
          <option value="price-asc" ${state.productSort === 'price-asc' ? 'selected' : ''}>Precio menor</option>
          <option value="stock-desc" ${state.productSort === 'stock-desc' ? 'selected' : ''}>Más stock</option>
          <option value="stock-asc" ${state.productSort === 'stock-asc' ? 'selected' : ''}>Menos stock</option>
        </select>
      </div>
      <div class="tt-commerce-bulkbar" ${state.productSelected.size && canBulk ? '' : 'hidden'}>
        <span class="tt-commerce-bulkcount">${state.productSelected.size} seleccionado${state.productSelected.size === 1 ? '' : 's'}</span>
        ${canToggle ? button('Activar', 'products-bulk-activate') : ''}
        ${canToggle ? button('Desactivar', 'products-bulk-deactivate') : ''}
        ${canExport ? button('Exportar selección', 'products-export-selected') : ''}
        ${button('Limpiar', 'products-clear-selection')}
      </div>
      ${!state.productsReady ? '<div class="tt-commerce-loading">Cargando productos…</div>' : list.length ? `
      <div class="tt-commerce-tablewrap">
        <table class="tt-commerce-table">
          <thead><tr>
            <th class="checkcol"><input type="checkbox" data-check-all="products" ${allVisibleSelected ? 'checked' : ''} aria-label="Seleccionar todos los productos visibles"></th>
            <th>Producto</th><th>Estado</th><th>Inventario</th><th>Precio</th><th>Colección</th><th></th>
          </tr></thead>
          <tbody>${list.map(product => {
            const status = productStatus(product);
            const stock = product.stock == null ? 'Sin límite' : Number(product.stock);
            const stockCls = product.stock == null ? 'ok' : Number(product.stock) <= 0 ? 'out' : Number(product.stock) <= 5 ? 'low' : 'ok';
            const variants = productVariantsCount(product);
            const selected = state.productSelected.has(product._docId);
            return `<tr data-open="product" data-id="${esc(product._docId)}" class="${selected ? 'is-selected' : ''}">
              <td class="checkcol" data-stop><input type="checkbox" data-select-product="${esc(product._docId)}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${esc(product.name || 'producto')}"></td>
              <td><div class="tt-commerce-productcell">${thumbHtml(productImage(product), product.name || 'Producto')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(product.name || 'Sin nombre')}</div><div class="tt-commerce-subtext">${variants ? `${variants} variante${variants === 1 ? '' : 's'} · ` : ''}${esc(product._docId)}</div></div></div></td>
              <td><span class="tt-commerce-badge ${status.cls}">${status.label}</span></td>
              <td><span class="tt-commerce-stock ${stockCls}">${stock}</span></td>
              <td><span class="tt-commerce-money">${formatMoney(product.price)}</span>${Number(product.priceBefore) > Number(product.price) ? `<div class="tt-commerce-subtext"><s>${formatMoney(product.priceBefore)}</s></div>` : ''}</td>
              <td>${esc(state.collections.find(c => c.slug === product.category)?.name || product.category || 'Sin colección')}</td>
              <td data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="product" data-id="${esc(product._docId)}" aria-label="Acciones">⋯</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : '<div class="tt-commerce-empty">No hay productos que coincidan con esta vista.</div>'}
      <div class="tt-commerce-footer"><span>Mostrando ${list.length} de ${state.products.length} productos</span><span>Los cambios se sincronizan automáticamente.</span></div>
    </div>`;
}

function renderCollections() {
  const root = document.getElementById('tt-commerce-collections');
  if (!root) return;
  const counts = collectionTabCounts();
  const list = filteredCollections();
  const selectedVisible = list.filter(c => state.collectionSelected.has(c.slug)).length;
  const allVisibleSelected = list.length > 0 && selectedVisible === list.length;
  const canCreate = perm('colecciones', 'crear', 'manageContent');
  const canEdit = perm('colecciones', 'editar', 'manageContent');
  const canToggle = perm('colecciones', 'activarDesactivar', 'manageContent');
  const canDelete = perm('colecciones', 'eliminar', 'deleteCollections');

  root.innerHTML = `
    <div class="tt-commerce-pagehead">
      <div class="tt-commerce-titlegroup">
        <h1 class="tt-commerce-title">Colecciones <span class="tt-commerce-count">${state.collections.length}</span></h1>
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
        ${button('Exportar selección', 'collections-export-selected')}
        ${button('Limpiar', 'collections-clear-selection')}
      </div>
      ${!state.collectionsReady ? '<div class="tt-commerce-loading">Cargando colecciones…</div>' : list.length ? `
      <div class="tt-commerce-tablewrap">
        <table class="tt-commerce-table">
          <thead><tr><th class="checkcol"><input type="checkbox" data-check-all="collections" ${allVisibleSelected ? 'checked' : ''}></th><th>Colección</th><th>Visibilidad</th><th>Productos</th><th>Orden</th><th></th></tr></thead>
          <tbody>${list.map(collectionItem => {
            const count = collectionProductCount(collectionItem.slug);
            const selected = state.collectionSelected.has(collectionItem.slug);
            return `<tr data-open="collection" data-id="${esc(collectionItem.slug)}" class="${selected ? 'is-selected' : ''}">
              <td class="checkcol" data-stop><input type="checkbox" data-select-collection="${esc(collectionItem.slug)}" ${selected ? 'checked' : ''}></td>
              <td><div class="tt-commerce-collectioncell">${thumbHtml(collectionItem.image, collectionItem.name || 'Colección')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(collectionItem.name || collectionItem.slug)}</div><div class="tt-commerce-subtext">/${esc(collectionItem.slug)}</div></div></div></td>
              <td><span class="tt-commerce-badge ${collectionItem.visible === false ? 'neutral' : 'success'}">${collectionItem.visible === false ? 'Oculta' : 'Visible'}</span></td>
              <td>${count}</td>
              <td>${Number(collectionItem.order) || 0}</td>
              <td data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="collection" data-id="${esc(collectionItem.slug)}" aria-label="Acciones">⋯</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : '<div class="tt-commerce-empty">No hay colecciones que coincidan con esta vista.</div>'}
      <div class="tt-commerce-footer"><span>Mostrando ${list.length} de ${state.collections.length} colecciones</span><span>El orden y la visibilidad impactan la tienda pública.</span></div>
    </div>`;
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
  const counts = orderTabCounts(), list = filteredOrders(), showingTrash = state.orderTab === 'deleted';
  const metrics = orderMetrics();
  const sourceTotal = showingTrash ? state.trashOrders.length : state.orders.length;
  const selectedVisible = showingTrash ? 0 : list.filter(o => state.orderSelected.has(o.id)).length;
  const allVisibleSelected = !showingTrash && list.length > 0 && selectedVisible === list.length;
  const canBulk = !showingTrash && perm('pedidos', 'accionesMasivas', 'manageOrders');
  const canExport = perm('pedidos', 'exportar', 'manageOrders') || state.role === 'viewer';
  const canUpdate = !showingTrash && perm('pedidos', 'cambiarEstado', 'manageOrders');
  const canUpdatePay = !showingTrash && perm('pedidos', 'cambiarPago', 'manageOrders');
  const isSuper = state.role === 'superadmin';
  root.innerHTML = `
    <div class="tt-commerce-pagehead"><div class="tt-commerce-titlegroup"><h1 class="tt-commerce-title">Pedidos <span class="tt-commerce-count">${sourceTotal}</span></h1><div class="tt-commerce-subtitle">${showingTrash ? 'Pedidos retirados de la lista activa. Podés restaurarlos o eliminarlos definitivamente.' : 'Pago, preparación, entrega y datos del pedido en una sola vista.'}</div></div><div class="tt-commerce-actions">${isSuper ? button('Reiniciar TINPED', 'orders-reset-sequence') + button('+ Nuevo pedido', 'orders-manual-new', { primary: true }) : ''}${canExport ? button('Exportar', 'orders-export') : ''}</div></div>
    ${!showingTrash ? `<div class="tt-commerce-order-metrics" aria-label="Resumen de pedidos de hoy"><div><strong>${metrics.today}</strong><span>Pedidos hoy</span></div><div><strong>${formatMoney(metrics.revenue)}</strong><span>Ventas de hoy</span></div><div><strong>${metrics.pending}</strong><span>Pagos pendientes</span></div><div><strong>${metrics.unfulfilled}</strong><span>Sin preparar</span></div><div><strong>${metrics.delivered}</strong><span>Entregados</span></div><div><strong>${metrics.items}</strong><span>Artículos hoy</span></div></div>` : ''}
    <div class="tt-commerce-card"><div class="tt-commerce-tabs">${tabButton('orders', 'all', 'Todos', counts.all, state.orderTab)}${tabButton('orders', 'unpaid', 'Sin pagar', counts.unpaid, state.orderTab)}${tabButton('orders', 'unfulfilled', 'Sin entregar', counts.unfulfilled, state.orderTab)}${tabButton('orders', 'delivered', 'Entregados', counts.delivered, state.orderTab)}${tabButton('orders', 'canceled', 'Cancelados', counts.canceled, state.orderTab)}${tabButton('orders', 'refunded', 'Reembolsados', counts.refunded, state.orderTab)}${isSuper ? tabButton('orders', 'deleted', 'Borrados', counts.deleted, state.orderTab) : ''}</div><div class="tt-commerce-toolbar"><label class="tt-commerce-search"><input class="tt-commerce-input" data-filter="order-search" type="search" value="${esc(state.orderSearch)}" placeholder="TINPED, cliente, email o producto"></label><select class="tt-commerce-select" data-filter="order-status"><option value="">Todos los estados</option>${ORDER_STATUS_VALUES.map(v => `<option value="${v}" ${state.orderStatus === v ? 'selected' : ''}>${esc(ORDER_STATUS_LABELS[v])}</option>`).join('')}</select><select class="tt-commerce-select" data-filter="order-pay"><option value="">Todos los pagos</option>${PAY_STATUS_VALUES.map(v => `<option value="${v}" ${state.orderPay === v ? 'selected' : ''}>${esc(PAY_STATUS_LABELS[v])}</option>`).join('')}</select><select class="tt-commerce-select" data-filter="order-sort"><option value="date-desc" ${state.orderSort === 'date-desc' ? 'selected' : ''}>Más recientes</option><option value="date-asc" ${state.orderSort === 'date-asc' ? 'selected' : ''}>Más antiguos</option></select></div><div class="tt-commerce-bulkbar" ${state.orderSelected.size && canBulk ? '' : 'hidden'}><span class="tt-commerce-bulkcount">${state.orderSelected.size} seleccionado${state.orderSelected.size === 1 ? '' : 's'}</span>${canUpdate ? button('En preparación', 'orders-bulk-preparing') + button('En camino', 'orders-bulk-way') + button('Entregado', 'orders-bulk-delivered') : ''}${canUpdatePay ? button('Marcar pagado', 'orders-bulk-paid') : ''}${canExport ? button('Exportar selección', 'orders-export-selected') : ''}${button('Limpiar', 'orders-clear-selection')}</div>${showingTrash && !state.trashReady ? '<div class="tt-commerce-loading">Cargando Borrados…</div>' : !showingTrash && !state.ordersReady ? '<div class="tt-commerce-loading">Cargando pedidos…</div>' : list.length ? `<div class="tt-commerce-tablewrap"><table class="tt-commerce-table tt-commerce-orders-table"><thead><tr><th class="checkcol">${showingTrash ? '' : `<input type="checkbox" data-check-all="orders" ${allVisibleSelected ? 'checked' : ''}>`}</th><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Preparación</th><th>Artículos</th><th>Entrega</th><th>Total</th><th></th></tr></thead><tbody>${list.map(order => { const customer=orderCustomer(order), shipping=orderShipping(order), status=orderStatus(order), pay=payStatus(order), items=orderItems(order), selected=!showingTrash&&state.orderSelected.has(order.id); const channel=order.channel || order.source || 'Tienda web'; const itemCount=items.reduce((sum,item)=>sum+Number(item?.qty ?? item?.quantity ?? 1),0); const delivery=[shipping.method, shipping.city].filter(v=>v && v !== '—').join(' · ') || 'Sin indicar'; return `<tr ${showingTrash ? '' : 'data-open="order"'} data-id="${esc(order.id)}" class="${selected ? 'is-selected' : ''}"><td class="checkcol" data-stop>${showingTrash ? '' : `<input type="checkbox" data-select-order="${esc(order.id)}" ${selected ? 'checked' : ''}>`}</td><td><div class="tt-commerce-maintext">#${esc(orderDisplayId(order))}</div><div class="tt-commerce-subtext">${showingTrash ? 'Recuperable' : itemCount + ' artículo' + (itemCount === 1 ? '' : 's')}</div></td><td>${esc(formatDate(showingTrash ? (order.trashMeta?.trashedAt || order.updatedAt || order.createdAt) : order.createdAt))}</td><td><div class="tt-commerce-maintext">${esc(customer.name)}</div><div class="tt-commerce-subtext">${esc(customer.email || customer.phone || 'Sin contacto')}</div></td><td>${esc(channel)}</td><td><span class="tt-commerce-badge ${payStatusBadge(pay)}">${esc(PAY_STATUS_LABELS[pay] || pay)}</span></td><td><span class="tt-commerce-badge ${orderStatusBadge(status)}">${esc(ORDER_STATUS_LABELS[status] || status)}</span></td><td class="tt-commerce-number">${itemCount}</td><td><span class="tt-commerce-delivery">${esc(delivery)}</span></td><td><span class="tt-commerce-money">${formatMoney(order.total)}</span></td><td data-stop><button type="button" class="tt-commerce-iconbtn" data-menu="${showingTrash ? 'trash-order' : 'order'}" data-id="${esc(order.id)}" aria-label="Acciones del pedido">⋯</button></td></tr>`; }).join('')}</tbody></table></div>` : `<div class="tt-commerce-empty">${showingTrash ? 'No hay pedidos en Borrados.' : 'No hay pedidos que coincidan con esta vista.'}</div>`}<div class="tt-commerce-footer"><span>Mostrando ${list.length} de ${sourceTotal} pedidos</span><span>${showingTrash ? 'Restaurar no reutiliza ni altera el contador TINPED.' : 'El código TINPED es correlativo y no se reutiliza al borrar.'}</span></div></div>`;
}

function renderAll() {
  renderProducts();
  renderCollections();
  renderOrders();
  renderDrawer();
}

function csvEscape(value) {
  const text = String(value ?? '');
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
    ['ID', 'Nombre', 'Colección', 'Precio', 'Precio anterior', 'Stock', 'Estado', 'Oferta', 'Destacado'],
    ...source.map(p => [p._docId, p.name || '', p.category || '', p.price ?? '', p.priceBefore ?? '', p.stock ?? '', p.active === false ? 'Inactivo' : 'Activo', p.oferta ? 'Sí' : 'No', p.destacado ? 'Sí' : 'No'])
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
  if (type === 'product') { const product=state.products.find(p=>p._docId===id); if(!product)return[]; const out=[{label:'Ver detalles',action:'drawer-product'}]; if(perm('productos','editar','editProducts'))out.push({label:'Editar producto',action:'product-edit'}); if(perm('productos','activarDesactivar','editProducts'))out.push({label:product.active===false?'Activar producto':'Desactivar producto',action:'product-toggle'}); if(perm('productos','eliminar','deleteProducts'))out.push({sep:true},{label:'Eliminar producto',action:'product-delete',danger:true}); return out; }
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

function openDrawer(type, id) {
  state.drawer = { type, id };
  renderDrawer();
}

function closeDrawer() {
  state.drawer = null;
  renderDrawer();
}

function kvRow(label, value) {
  return `<dt>${esc(label)}</dt><dd>${value == null || value === '' ? '—' : esc(value)}</dd>`;
}

function productDrawer(product) {
  const status = productStatus(product);
  const collectionItem = state.collections.find(c => c.slug === product.category);
  const variants = productVariantsCount(product);
  return {
    title: product.name || 'Producto sin nombre',
    kicker: `Producto · ${product._docId}`,
    body: `
      <div class="tt-commerce-drawer-section" style="display:flex;gap:12px;align-items:center">${thumbHtml(productImage(product), product.name || 'Producto')}<div><span class="tt-commerce-badge ${status.cls}">${status.label}</span><div style="margin-top:7px;font-size:16px;font-weight:780">${formatMoney(product.price)}</div></div></div>
      <div class="tt-commerce-drawer-section"><h4>Información</h4><dl class="tt-commerce-kv">${kvRow('Colección', collectionItem?.name || product.category || 'Sin colección')}${kvRow('Stock', product.stock == null ? 'Sin control' : String(product.stock))}${kvRow('Variantes', variants ? String(variants) : 'Sin variantes')}${kvRow('Oferta', product.oferta ? 'Sí' : 'No')}${kvRow('Destacado', product.destacado ? 'Sí' : 'No')}</dl></div>
      ${product.description ? `<div class="tt-commerce-drawer-section"><h4>Descripción</h4><div style="font-size:11px;line-height:1.6;color:var(--tt-commerce-muted)">${esc(product.description)}</div></div>` : ''}
    `,
    actions: `
      ${perm('productos', 'editar', 'editProducts') ? button('Editar', 'drawer-product-edit', { primary: true, extra: `data-id="${esc(product._docId)}"` }) : ''}
      ${perm('productos', 'activarDesactivar', 'editProducts') ? button(product.active === false ? 'Activar' : 'Desactivar', 'drawer-product-toggle', { extra: `data-id="${esc(product._docId)}"` }) : ''}
      ${perm('productos', 'eliminar', 'deleteProducts') ? button('Eliminar', 'drawer-product-delete', { danger: true, extra: `data-id="${esc(product._docId)}"` }) : ''}
    `
  };
}

function collectionDrawer(collectionItem) {
  const products = state.products.filter(p => p.category === collectionItem.slug).sort((a, b) => (Number(a.collectionOrder ?? 9999) - Number(b.collectionOrder ?? 9999)));
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
  const customer = orderCustomer(order);
  const shipping = orderShipping(order);
  const items = orderItems(order);
  const status = orderStatus(order);
  const pay = payStatus(order);
  const canEditStatus = perm('pedidos', 'cambiarEstado', 'manageOrders');
  const canEditPay = perm('pedidos', 'cambiarPago', 'manageOrders');
  const canSensitive = state.role === 'superadmin' || canDo(state.role, 'pedidos', 'verDatosSensibles');
  const canAddress = state.role === 'superadmin' || canDo(state.role, 'pedidos', 'verDireccion');
  return {
    title: `#${orderDisplayId(order)}`,
    kicker: formatDate(order.createdAt),
    body: `
      <div class="tt-commerce-drawer-section"><div style="display:flex;gap:7px;flex-wrap:wrap"><span class="tt-commerce-badge ${payStatusBadge(pay)}">${esc(PAY_STATUS_LABELS[pay] || pay)}</span><span class="tt-commerce-badge ${orderStatusBadge(status)}">${esc(ORDER_STATUS_LABELS[status] || status)}</span></div></div>
      <div class="tt-commerce-drawer-section"><h4>Cliente</h4><dl class="tt-commerce-kv">${kvRow('Nombre', customer.name)}${canSensitive ? kvRow('Email', customer.email) + kvRow('Teléfono', customer.phone) : ''}</dl></div>
      <div class="tt-commerce-drawer-section"><h4>Productos</h4>${items.map(item => `<div class="tt-commerce-lineitem">${thumbHtml(itemImage(item), item?.name || item?.title || 'Producto')}<div style="min-width:0"><div class="tt-commerce-maintext">${esc(item?.name || item?.title || 'Producto')}</div><div class="tt-commerce-subtext">${Number(item?.qty || item?.quantity || 1)} × ${formatMoney(item?.price)}</div></div><span class="tt-commerce-lineitem-price">${formatMoney(Number(item?.qty || item?.quantity || 1) * Number(item?.price || 0))}</span></div>`).join('') || '<div class="tt-commerce-subtext">Sin productos registrados.</div>'}</div>
      <div class="tt-commerce-drawer-section"><h4>Totales</h4><dl class="tt-commerce-kv">${kvRow('Subtotal', formatMoney(order.subtotal))}${kvRow('Envío', formatMoney(order.shippingCost ?? order.shipping?.cost ?? 0))}${kvRow('Total', formatMoney(order.total))}</dl></div>
      <div class="tt-commerce-drawer-section"><h4>Entrega</h4><dl class="tt-commerce-kv">${kvRow('Método', shipping.method)}${kvRow('Ciudad', shipping.city)}${canAddress ? kvRow('Dirección', shipping.address) + kvRow('Referencia', shipping.reference || shipping.agency || shipping.mode) : ''}</dl></div>
      ${(canEditStatus || canEditPay) ? `<div class="tt-commerce-drawer-section"><h4>Actualizar</h4><div style="display:grid;gap:8px">${canEditStatus ? `<select class="tt-commerce-select" data-drawer-order-status="${esc(order.id)}">${ORDER_STATUS_VALUES.map(v => `<option value="${v}" ${status === v ? 'selected' : ''}>${esc(ORDER_STATUS_LABELS[v])}</option>`).join('')}</select>` : ''}${canEditPay ? `<select class="tt-commerce-select" data-drawer-order-pay="${esc(order.id)}">${PAY_STATUS_VALUES.map(v => `<option value="${v}" ${pay === v ? 'selected' : ''}>${esc(PAY_STATUS_LABELS[v])}</option>`).join('')}</select>` : ''}</div></div>` : ''}
      ${order.notes ? `<div class="tt-commerce-drawer-section"><h4>Notas</h4><div style="font-size:11px;line-height:1.6;color:var(--tt-commerce-muted)">${esc(order.notes)}</div></div>` : ''}
    `,
    actions: `
      ${perm('pedidos', 'editarCompleto', 'manageOrdersFull') ? button('Editar pedido', 'drawer-order-edit', { primary: true, extra: `data-id="${esc(order.id)}"` }) : ''}
      ${customer.phone ? button('WhatsApp', 'drawer-order-whatsapp', { extra: `data-id="${esc(order.id)}"` }) : ''}
      ${perm('pedidos', 'reenviarCorreo', 'manageOrders') ? button('Reenviar correo', 'drawer-order-resend', { extra: `data-id="${esc(order.id)}"` }) : ''}
      ${perm('pedidos', 'eliminar', 'deleteOrders') ? button('Eliminar', 'drawer-order-delete', { danger: true, extra: `data-id="${esc(order.id)}"` }) : ''}
    `
  };
}

function renderDrawer() {
  ensureDrawerDom();
  const drawer = document.getElementById('tt-commerce-drawer');
  const backdrop = document.getElementById('tt-commerce-drawer-backdrop');
  if (!state.drawer) {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.innerHTML = '';
    return;
  }

  let content = null;
  if (state.drawer.type === 'product') content = productDrawer(state.products.find(p => p._docId === state.drawer.id));
  if (state.drawer.type === 'collection') content = collectionDrawer(state.collections.find(c => c.slug === state.drawer.id));
  if (state.drawer.type === 'order') content = orderDrawer(state.orders.find(o => o.id === state.drawer.id));
  if (!content) { state.drawer = null; renderDrawer(); return; }

  drawer.innerHTML = `<div class="tt-commerce-drawer-head"><div class="tt-commerce-drawer-heading"><h3 class="tt-commerce-drawer-title">${esc(content.title)}</h3><div class="tt-commerce-drawer-kicker">${esc(content.kicker)}</div></div><button type="button" class="tt-commerce-iconbtn" data-action="drawer-close" aria-label="Cerrar">×</button></div><div class="tt-commerce-drawer-body">${content.body}</div><div class="tt-commerce-drawer-actions">${content.actions}</div>`;
  requestAnimationFrame(() => {
    drawer.classList.add('open');
    backdrop.classList.add('open');
  });
}

function setBusy(value) {
  state.busy = value;
  document.querySelectorAll('.tt-commerce-btn').forEach(btn => {
    if (value) btn.setAttribute('aria-busy', 'true');
  });
}

async function bulkProducts(active) {
  const ids = [...state.productSelected];
  if (!ids.length || state.busy) return;
  setBusy(true);
  try {
    let changed = 0;
    for (const id of ids) {
      const product = state.products.find(p => p._docId === id);
      if (!product || (product.active !== false) === active) continue;
      if (typeof window.prodToggleActive !== 'function') throw new Error('La acción de producto todavía no está disponible.');
      await window.prodToggleActive(id, product.active !== false);
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
  const ids = [...state.orderSelected];
  if (!ids.length || state.busy) return;
  setBusy(true);
  const isPay = kind === 'pagado';
  try {
    const fn = isPay ? window.updatePayStatus : window.updateOrderStatus;
    if (typeof fn !== 'function') throw new Error('La acción de pedidos todavía no está disponible.');
    for (const id of ids) await fn(id, kind);
    state.orderSelected.clear();
    toast(`${ids.length} pedido${ids.length === 1 ? '' : 's'} actualizado${ids.length === 1 ? '' : 's'}.`);
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

function openWhatsApp(order) {
  const customer = orderCustomer(order);
  const digits = String(customer.phone || '').replace(/\D/g, '');
  if (!digits) { toast('Este pedido no tiene teléfono.'); return; }
  const normalized = digits.startsWith('595') ? digits : `595${digits.replace(/^0+/, '')}`;
  const text = encodeURIComponent(`Hola ${customer.name || ''}! Te escribo por tu pedido #${order.id} de Tintin.`);
  window.open(`https://wa.me/${normalized}?text=${text}`, '_blank', 'noopener,noreferrer');
}

async function handleAction(action, element) {
  const id = element?.dataset?.id || element?.dataset?.menuId || '';
  if (action === 'drawer-close') return closeDrawer();
  if (action === 'product-new') { closeDrawer(); return window.prodNuevo?.(); }
  if (action === 'products-import') return clickSection('importar');
  if (action === 'products-export') return exportProducts(false);
  if (action === 'products-export-selected') return exportProducts(true);
  if (action === 'products-clear-selection') { state.productSelected.clear(); return renderProducts(); }
  if (action === 'products-bulk-activate') return bulkProducts(true);
  if (action === 'products-bulk-deactivate') return bulkProducts(false);
  if (action === 'product-edit' || action === 'drawer-product-edit') { closeDrawer(); return window.prodEditar?.(id); }
  if (action === 'product-toggle' || action === 'drawer-product-toggle') {
    const p = state.products.find(x => x._docId === id); if (!p) return;
    return window.prodToggleActive?.(id, p.active !== false);
  }
  if (action === 'product-delete' || action === 'drawer-product-delete') { closeDrawer(); return window.prodEliminar?.(id); }
  if (action === 'drawer-product') return openDrawer('product', id);

  if (action === 'collection-new') { closeDrawer(); return window.collNueva?.(); }
  if (action === 'collections-export-selected') return exportCollections(true);
  if (action === 'collections-clear-selection') { state.collectionSelected.clear(); return renderCollections(); }
  if (action === 'collection-edit' || action === 'drawer-collection-edit') { closeDrawer(); return window.collEditar?.(id); }
  if (action === 'collection-products' || action === 'drawer-collection-products') { closeDrawer(); return window.collVerProductos?.(id); }
  if (action === 'collection-delete' || action === 'drawer-collection-delete') {
    const count = collectionProductCount(id); closeDrawer(); return window.collEliminar?.(id, count);
  }
  if (action === 'drawer-collection') return openDrawer('collection', id);

  if (action === 'orders-manual-new') return window.TintinOrderAdmin?.openManualOrder();
  if (action === 'orders-reset-sequence') return window.TintinOrderAdmin?.resetOrderSequence();
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
    if (module === 'products') { state.productTab = tab.dataset.tab; state.productSelected.clear(); renderProducts(); }
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
  if (target.matches('[data-select-product]')) {
    target.checked ? state.productSelected.add(target.dataset.selectProduct) : state.productSelected.delete(target.dataset.selectProduct);
    return renderProducts();
  }
  if (target.matches('[data-select-collection]')) {
    target.checked ? state.collectionSelected.add(target.dataset.selectCollection) : state.collectionSelected.delete(target.dataset.selectCollection);
    return renderCollections();
  }
  if (target.matches('[data-select-order]')) {
    target.checked ? state.orderSelected.add(target.dataset.selectOrder) : state.orderSelected.delete(target.dataset.selectOrder);
    return renderOrders();
  }
  if (target.matches('[data-check-all="products"]')) {
    filteredProducts().forEach(p => target.checked ? state.productSelected.add(p._docId) : state.productSelected.delete(p._docId));
    return renderProducts();
  }
  if (target.matches('[data-check-all="collections"]')) {
    filteredCollections().forEach(c => target.checked ? state.collectionSelected.add(c.slug) : state.collectionSelected.delete(c.slug));
    return renderCollections();
  }
  if (target.matches('[data-check-all="orders"]')) {
    filteredOrders().forEach(o => target.checked ? state.orderSelected.add(o.id) : state.orderSelected.delete(o.id));
    return renderOrders();
  }

  const filter = target.dataset.filter;
  if (filter === 'product-category') { state.productCategory = target.value; return renderProducts(); }
  if (filter === 'product-stock') { state.productStock = target.value; return renderProducts(); }
  if (filter === 'product-sort') { state.productSort = target.value; return renderProducts(); }
  if (filter === 'collection-visibility') { state.collectionVisibility = target.value; return renderCollections(); }
  if (filter === 'collection-sort') { state.collectionSort = target.value; return renderCollections(); }
  if (filter === 'order-status') { state.orderStatus = target.value; return renderOrders(); }
  if (filter === 'order-pay') { state.orderPay = target.value; return renderOrders(); }
  if (filter === 'order-sort') { state.orderSort = target.value; return renderOrders(); }

  if (target.matches('[data-drawer-order-status]')) {
    const id = target.dataset.drawerOrderStatus;
    window.updateOrderStatus?.(id, target.value);
  }
  if (target.matches('[data-drawer-order-pay]')) {
    const id = target.dataset.drawerOrderPay;
    window.updatePayStatus?.(id, target.value);
  }
}

let searchTimer = null;
function onInput(event) {
  const filter = event.target.dataset.filter;
  if (!['product-search', 'collection-search', 'order-search'].includes(filter)) return;
  clearTimeout(searchTimer);
  const value = event.target.value;
  searchTimer = setTimeout(() => {
    if (filter === 'product-search') { state.productSearch = value; renderProducts(); }
    if (filter === 'collection-search') { state.collectionSearch = value; renderCollections(); }
    if (filter === 'order-search') { state.orderSearch = value; renderOrders(); }
  }, 120);
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
    section.classList.add('tt-commerce-mounted');
    const shell = document.createElement('div');
    shell.id = rootId;
    shell.className = 'tt-commerce-shell';
    section.prepend(shell);
  });
  syncLegacyFormVisibility();
  renderAll();
}

function visible(el) {
  if (!el) return false;
  return getComputedStyle(el).display !== 'none' && !el.hidden;
}

function syncLegacyFormVisibility() {
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

function subscribeData() {
  state.unsubscribers.forEach(unsub => { try { unsub(); } catch {} });
  state.unsubscribers = [];
  if (state.trashUnsubscribe) {
    try { state.trashUnsubscribe(); } catch {}
    state.trashUnsubscribe = null;
  }

  state.unsubscribers.push(onSnapshot(collection(db, 'products'), snapshot => {
    state.products = snapshot.docs.map(snap => ({ _docId: snap.id, ...snap.data() }));
    state.productsReady = true;
    state.productSelected = new Set([...state.productSelected].filter(id => state.products.some(p => p._docId === id)));
    renderProducts(); renderCollections(); renderDrawer();
  }, error => {
    state.productsReady = true;
    console.error('[shopify-commerce] products:', error);
    toast('No se pudieron actualizar los productos en tiempo real.', 5000);
    renderProducts();
  }));

  state.unsubscribers.push(onSnapshot(collection(db, 'collections'), snapshot => {
    state.collections = snapshot.docs.map(snap => normalizeCollectionDoc(snap.id, snap.data())).filter(Boolean);
    state.collectionsReady = true;
    state.collectionSelected = new Set([...state.collectionSelected].filter(slug => state.collections.some(c => c.slug === slug)));
    renderCollections(); renderProducts(); renderDrawer();
  }, error => {
    state.collectionsReady = true;
    console.error('[shopify-commerce] collections:', error);
    toast('No se pudieron actualizar las colecciones en tiempo real.', 5000);
    renderCollections();
  }));

  state.unsubscribers.push(onSnapshot(collection(db, 'orders'), snapshot => {
    state.orders = snapshot.docs.map(snap => ({ id: snap.id, ...snap.data() }));
    state.ordersReady = true;
    state.orderSelected = new Set([...state.orderSelected].filter(id => state.orders.some(o => o.id === id)));
    if (state.role === 'superadmin') window.TintinOrderAdmin?.ensureMissingOrderNumbers(state.orders);
    renderOrders(); renderDrawer();
  }, error => {
    state.ordersReady = true;
    console.error('[shopify-commerce] orders:', error);
    toast('No se pudieron actualizar los pedidos en tiempo real.', 5000);
    renderOrders();
  }));

  state.trashOrders = [];
  state.trashReady = state.role !== 'superadmin';
  if (state.orderTab === 'deleted') ensureTrashSubscription();
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
  state.user = user;
  await loadRolePermissions();
  state.role = await getUserRole(user.uid, user.email);
  state.ready = true;
  mountShells();
  observeLegacyForms();
  subscribeData();
}

function boot() {
  ensureCss();
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('click', event => {
    if (!event.target.closest('#tt-commerce-menu,[data-menu]')) closeMenu();
  }, true);
  window.addEventListener('resize', closeMenu, { passive: true });
  window.addEventListener('scroll', closeMenu, { passive: true, capture: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeMenu(); closeDrawer(); }
  });

  onAuthStateChanged(auth, user => {
    if (user && !user.isAnonymous) bootForUser(user).catch(error => {
      console.error('[shopify-commerce] No se pudo iniciar:', error);
      toast('No se pudo iniciar la vista avanzada de comercio.', 5200);
    });
  });
}

if (!window.TintinShopifyCommerceAdminBooted) {
  window.TintinShopifyCommerceAdminBooted = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
