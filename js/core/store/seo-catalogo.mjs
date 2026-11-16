import {normalizeCollectionSlug} from './colecciones-publicas.mjs?v=tintin-20261116-discovery-1';
export const PUBLIC_ORIGIN = 'https://tintinaccs.com';
export const CATALOG_PAGE_SIZE = 48;

export function catalogUrl(slug = '', page = 1) {
  const url = new URL('/catalogo', PUBLIC_ORIGIN);
  if (slug && slug !== 'todos') url.searchParams.set('cat', normalizeCollectionSlug(slug));
  if (page > 1) url.searchParams.set('page', String(page));
  return url.href;
}

export function categoryCopy(slug, label = '') {
  const copy = {
    relojes: ['Relojes para mujer en Paraguay', 'Elegí tu reloj según el acabado, tamaño y material indicados en cada ficha. Consultá las opciones disponibles y coordiná retiro en San Lorenzo, delivery o encomienda al interior.'],
    bolsos: ['Bolsos y carteras en Paraguay', 'Compará colores, medidas y formas de uso de nuestros bolsos. Revisá la autenticidad y la modalidad de compra en cada ficha: los modelos bajo pedido requieren confirmación de disponibilidad antes de coordinar el envío.'],
    accesorios: ['Accesorios en Paraguay', 'Encontrá aros, collares, pulseras y otras piezas para combinar. Revisá materiales, medidas y disponibilidad en cada ficha. Retiro coordinado en San Lorenzo y envíos a Paraguay.'],
  };
  return copy[slug] || [label ? `${label} en Paraguay` : 'Accesorios y relojes en Paraguay',
    'Elegí por material, color y medidas reales de cada ficha. Comprá en Tintin Accesorios & Relojes con retiro coordinado en San Lorenzo, delivery en zonas habilitadas y encomienda al interior.'];
}

export function catalogMetadata(url) {
  const slug = normalizeCollectionSlug(url.searchParams.get('cat') || '');
  const page = /^\d+$/.test(url.searchParams.get('page') || '1') ? Number(url.searchParams.get('page') || 1) : 0;
  const canonical = catalogUrl(slug, page);
  const filtered = [...url.searchParams.keys()].some(key => !['cat','page'].includes(key) && !/^(utm_.+|gclid|fbclid)$/.test(key));
  return {slug, page, canonical, filtered};
}

