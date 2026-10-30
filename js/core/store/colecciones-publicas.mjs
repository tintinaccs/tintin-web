import { wristCategory } from './categorias-pulseras.mjs?v=tintin-20261014-pulseras-2';

export function normalizeCollectionSlug(value) {
  return String(wristCategory(value) ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .replace(/^bags?$/, 'bolsos').replace(/^ear-cuffs?$/, 'earcuff')
    .replace(/^arm-cuffs?$/, 'armcuff').replace(/^jewelry-box$/, 'joyeros');
}

export function firstEligibleCollectionProduct(slug, products, validImage) {
  if (!slug || !Array.isArray(products)) return null;
  return products.filter(product => product && normalizeCollectionSlug(product.category) === normalizeCollectionSlug(slug)
    && product.active !== false && product.name && validImage(product.imageUrl))
    .sort((a,b) =>
      (Number.isFinite(Number(a.collectionOrder)) ? Number(a.collectionOrder) : 9999)
      - (Number.isFinite(Number(b.collectionOrder)) ? Number(b.collectionOrder) : 9999)
      || String(a.name).localeCompare(String(b.name),'es'))[0] || null;
}
