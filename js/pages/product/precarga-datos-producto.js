/* Transporte público de la ficha: empieza antes del grafo Firebase del shell. */
import { fetchPublicCatalogResource } from '../../core/firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1-first-render-merge-20261010-1-bags-20261014-1';
import { readCached } from '../../core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';

let preload = null;
export function getProductPagePrefetch(id) {
  return preload?.id === String(id) && Date.now() - preload.startedAt < 30000 ? preload : null;
}

const isPreview = new URLSearchParams(location.search).get('ttVisualPreview') === '1' && window.parent !== window;
if (!isPreview && /(^|\/)product(?:\.html)?$/.test(location.pathname)) {
  const id = String(new URLSearchParams(location.search).get('id') || '').trim();
  if (id && id.length <= 256 && !/[\/?#\u0000-\u001f\u007f]/.test(id)) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    const params = new URLSearchParams({ resource: 'products', id });
    const response = fetch('/api/public-catalog?' + params, {
      credentials: 'omit', cache: 'default', signal: controller.signal,
    }).catch(() => null).finally(() => window.clearTimeout(timer));
    const cached = readCached('products:cards', 60000);
    const catalog = Array.isArray(cached) && cached.length
      ? null : fetchPublicCatalogResource('products').catch(() => null);
    preload = { id, response, catalog, startedAt: Date.now() };
  }
}
