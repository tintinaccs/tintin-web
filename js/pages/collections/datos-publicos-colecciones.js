/* Metadata pública compartida: sin Firebase, imágenes de configuración ni Auth. */
import { wristCategory, unifyWristCollections } from '../../core/store/categorias-pulseras.mjs?v=tintin-20261014-pulseras-2';
import { cleanText, cleanMultilineText } from '../../core/auth/utilidades-seguridad.js?v=tintin-20260716-cloudinary-fix-1';
import { sanitizeImageUrl } from '../../components/images/utilidades-imagenes.js?v=tintin-20260716-cloudinary-fix-1';
import { readCached, readStaleCached, runSingleFlight, writeCached } from '../../core/firebase/cache-lecturas-firestore.js?v=tintin-20260720-read-budget-1';
import { fetchPublicCatalogResource } from '../../core/firebase/catalogo-publico-api.js?v=tintin-20260814-edge-catalog-1-first-render-merge-20261010-1-bags-20261014-1';
export const CACHE_KEY = 'collections:public:unified-v2';
const CACHE_TTL = 30 * 60 * 1000;
export function normalizeCollectionDoc(id, data) {
  const d = data || {};
  const orderNum = Number(d.order);
  return {
    slug: id,
    name: cleanText(d.name || d.title || id, 120),
    description: cleanMultilineText(d.description || '', 1000),
    image: sanitizeImageUrl(d.image || d.imageUrl || ''),
    order: Number.isFinite(orderNum) ? orderNum : 9999,
    visible: d.visible !== false
  };
}

export function normalizeCollectionSlug(value) {
  return String(wristCategory(value) ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .replace(/^bags?$/, 'bolsos').replace(/^ear-cuffs?$/, 'earcuff')
    .replace(/^arm-cuffs?$/, 'armcuff').replace(/^jewelry-box$/, 'joyeros');
}

export function canonicalPublicCollections(collections) {
  const seen = new Set();
  return sortCols(unifyWristCollections(collections).filter(item => item.visible !== false)).flatMap(item => {
    const slug = normalizeCollectionSlug(item.slug);
    if (!slug) return [];
    if (seen.has(slug)) {
      console.warn('[collections-store] slug público duplicado:', slug);
      return [];
    }
    seen.add(slug);
    return [{ ...item, slug }];
  });
}

export function sortCols(list) {
  return list.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
}


export async function loadCollections(options = {}) {
  const emit = (list, source) => {
    const visible = canonicalPublicCollections(list);
    options.onData?.(visible, source);
    return visible;
  };
  if (!options.force) {
    const cached = readCached(CACHE_KEY, CACHE_TTL);
    if (Array.isArray(cached)) return emit(cached, 'cache');
  }
  const stale = readStaleCached(CACHE_KEY);
  if (!options.force && Array.isArray(stale) && stale.length) emit(stale, 'stale-cache');
  try {
    const list = await runSingleFlight('collections:public', async () => {
      const documents = await fetchPublicCatalogResource('collections');
      const rows = documents.map(item => normalizeCollectionDoc(item.id, item.data));
      writeCached(CACHE_KEY, rows);
      return rows;
    });
    return emit(list, 'edge-cache');
  } catch (error) {
    if (Array.isArray(stale) && stale.length) return emit(stale, 'stale-cache');
    throw error;
  }
}
