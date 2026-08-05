/* =============================================================
   TINTIN — Fase 7: política única de catálogo público

   Mantiene una sola definición de producto comprable para portada,
   catálogo, búsqueda, ficha directa, relacionados y carrito.
   ============================================================= */
import { loadCollections } from '../collections/estado-colecciones.js?v=tintin-20260726-browser-fallback-1';
import { isNewProduct, productActivityAtMillis, sortCatalogProducts, timestampToMillis } from './politica-exhibicion-catalogo.js?v=tintin-20260731-unified-store-1';

const CART_KEY = 'tt_cart';
let visibleCollectionSlugs = null;
let redispatching = false;
let detailGuardTimer = 0;

function clean(value, max = 180) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function unique(list, maxItems, maxLength) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const value = clean(raw, maxLength);
    const key = value.toLocaleLowerCase('es');
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function normalizeVariantOptions(value) {
  if (!value) return null;
  const groups = new Map();
  const add = (keyRaw, valueRaw) => {
    const key = clean(keyRaw, 60);
    if (!key) return;
    const values = Array.isArray(valueRaw)
      ? valueRaw
      : String(valueRaw == null ? '' : valueRaw).split(',');
    const normalized = unique(values, 50, 120);
    if (!normalized.length) return;
    const current = groups.get(key) || [];
    groups.set(key, unique([...current, ...normalized], 50, 120));
  };

  if (Array.isArray(value)) {
    value.slice(0, 100).forEach(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      Object.entries(item).forEach(([key, itemValue]) => {
        if (!['price', 'sku', 'imageUrl', 'stock', 'active'].includes(key)) add(key, itemValue);
      });
    });
  } else if (typeof value === 'object') {
    Object.entries(value).slice(0, 20).forEach(([key, itemValue]) => add(key, itemValue));
  }

  return groups.size ? Object.fromEntries(groups) : null;
}

export function normalizeProduct(product) {
  const p = product && typeof product === 'object' ? product : {};
  const price = Number(p.price);
  const stock = p.stock == null || p.stock === '' ? null : Number(p.stock);
  const category = clean(p.category || p.cat || '', 120);
  const description = clean(p.description || p.desc || '', 4000);
  return {
    ...p,
    id: clean(p.id, 180),
    name: clean(p.name, 180),
    category,
    cat: category,
    description,
    desc: description,
    price: Number.isFinite(price) ? Math.round(price) : NaN,
    stock: stock == null ? null : (Number.isFinite(stock) ? Math.floor(stock) : NaN),
    createdAt: timestampToMillis(p.createdAt ?? p.created_at ?? p.importedAt),
    updatedAt: timestampToMillis(p.updatedAt ?? p.updated_at ?? p.modifiedAt),
    restockedAt: timestampToMillis(p.restockedAt),
    catalogActivityAt: timestampToMillis(p.catalogActivityAt),
    tags: unique(Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(','), 30, 60),
    variants: normalizeVariantOptions(p.variants),
  };
}

function categoryIsVisible(product) {
  if (!(visibleCollectionSlugs instanceof Set)) return true;
  return visibleCollectionSlugs.has(product.category || product.cat || '');
}

export function isCatalogVisible(product) {
  const p = normalizeProduct(product);
  return Boolean(
    p.id &&
    p.name &&
    p.category &&
    p.active !== false &&
    Number.isInteger(p.price) &&
    p.price > 0 &&
    p.price <= 1_000_000_000 &&
    (p.stock == null || Number.isInteger(p.stock)) &&
    categoryIsVisible(p)
  );
}

export function isPurchasable(product) {
  const p = normalizeProduct(product);
  return isCatalogVisible(p) && (p.stock == null || p.stock > 0);
}

export function hasVariants(product) {
  const variants = normalizeVariantOptions(product?.variants);
  return Boolean(variants && Object.values(variants).some(values => values.length));
}

function variantIsValid(product, selectedVariant) {
  const variants = normalizeVariantOptions(product?.variants);
  if (!variants) return true;
  const selected = String(selectedVariant || '').split('/').map(value => clean(value, 120)).filter(Boolean);
  const groups = Object.values(variants);
  return selected.length === groups.length && selected.every((value, index) => groups[index].includes(value));
}

function sameJson(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

let reconcilingCart = false;
export function reconcileCatalogCart(products = window.PRODUCTS || []) {
  const catalog = new Map(products.filter(isPurchasable).map(raw => {
    const product = normalizeProduct(raw);
    return [String(product.id), product];
  }));
  let current;
  try { current = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { current = []; }
  if (!Array.isArray(current)) current = [];

  const next = current.slice(0, 100).map(raw => {
    if (!raw || typeof raw !== 'object') return null;
    const product = catalog.get(String(raw.id || ''));
    if (!product || !variantIsValid(product, raw.variant)) return null;
    const requested = Number(raw.qty);
    const max = product.stock == null ? 99 : product.stock;
    const qty = Math.max(1, Math.min(max, Number.isFinite(requested) ? Math.floor(requested) : 1));
    return {
      ...raw,
      id: product.id,
      name: product.name,
      cat: product.category,
      price: product.price,
      qty,
      stock: product.stock,
      imageUrl: product.imageUrl || raw.imageUrl || '',
      imgUrl: product.imageUrl || raw.imgUrl || raw.imageUrl || '',
      variant: clean(raw.variant || '', 240),
    };
  }).filter(Boolean);

  // sincronizacion-carrito.js intercepta este mismo localStorage.setItem/getItem con su
  // propio modelo de carrito (lineId, etc.), de forma normal e independiente
  // de esta política. Cuando ambos sistemas normalizan el mismo cambio de
  // forma distinta, cada uno ve al otro como "todavía desactualizado" y se
  // vuelven a disparar entre sí sin parar — el click de "Agregar al
  // carrito" terminaba en "Maximum call stack size exceeded" y la página
  // quedaba rota. reconcilingCart corta la reentrada: mientras este mismo
  // reconcile sigue en curso (el dispatch de abajo es síncrono y puede
  // volver a llamar a esta función antes de terminar), la llamada anidada
  // devuelve el cart calculado sin volver a escribir ni a disparar el
  // evento, así el ciclo no tiene forma de repetirse indefinidamente.
  if (!sameJson(current, next) && !reconcilingCart) {
    reconcilingCart = true;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('tt_cart_updated', { detail: { source: 'phase7-catalog-policy' } }));
    } finally {
      reconcilingCart = false;
    }
  }
  return next;
}

function filterProducts(products) {
  return sortCatalogProducts(
    (Array.isArray(products) ? products : [])
      .map(normalizeProduct)
      .filter(isCatalogVisible)
  );
}

function publishFiltered(products, source = 'phase7-policy') {
  const filtered = filterProducts(products);
  window.PRODUCTS = filtered;
  reconcileCatalogCart(filtered);
  redispatching = true;
  window.dispatchEvent(new CustomEvent('tintin:products-loaded', {
    detail: { products: filtered, source }
  }));
  redispatching = false;

  const path = location.pathname.toLowerCase();
  if (/(^|\/)product(?:\.html)?$/.test(path)) {
    const id = new URLSearchParams(location.search).get('id');
    if (id && !filtered.some(product => String(product.id) === String(id))) {
      window._showProductNotFound?.();
    }
  }
  return filtered;
}

window.addEventListener('tintin:products-loaded', event => {
  if (redispatching || event.detail?.source === 'phase7-policy' || event.detail?.source === 'phase7-collections') return;
  event.stopImmediatePropagation();
  publishFiltered(event.detail?.products, 'phase7-policy');
}, true);

function installDetailGuard() {
  const original = window._renderProductDetail;
  if (typeof original !== 'function' || original.__ttPhase7Guard) return false;
  function guarded(product) {
    const normalized = normalizeProduct(product);
    if (!isCatalogVisible(normalized)) {
      window._showProductNotFound?.();
      return undefined;
    }
    return original(normalized);
  }
  guarded.__ttPhase7Guard = true;
  guarded.__ttPhase7Original = original;
  window._renderProductDetail = guarded;
  return true;
}

function keepDetailGuardInstalled() {
  installDetailGuard();
  let attempts = 0;
  detailGuardTimer = window.setInterval(() => {
    attempts += 1;
    installDetailGuard();
    if (attempts >= 200 || window._renderProductDetail?.__ttPhase7Guard) {
      window.clearInterval(detailGuardTimer);
      detailGuardTimer = 0;
    }
  }, 50);
}

loadCollections().then(collections => {
  visibleCollectionSlugs = new Set(collections.map(collection => collection.slug));
  if (Array.isArray(window.PRODUCTS)) publishFiltered(window.PRODUCTS, 'phase7-collections');
}).catch(error => {
  console.warn('[phase7-catalog-policy] No se pudo confirmar la visibilidad de colecciones; se conserva el catálogo validado sin ese filtro.', error);
});

keepDetailGuardInstalled();
window.addEventListener('pagehide', () => {
  if (detailGuardTimer) window.clearInterval(detailGuardTimer);
}, { once: true });

window.TintinCatalogPolicy = {
  normalizeProduct,
  normalizeVariantOptions,
  isCatalogVisible,
  isPurchasable,
  hasVariants,
  isNewProduct,
  productActivityAtMillis,
  sortProducts: sortCatalogProducts,
  reconcileCart: reconcileCatalogCart,
  getVisibleCollections: () => visibleCollectionSlugs ? [...visibleCollectionSlugs] : null,
};
