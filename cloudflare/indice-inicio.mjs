import { hasProductStock } from '../js/core/store/inventario-variantes.mjs';
import { hasPublicProductFields } from '../js/core/store/publicacion-producto.mjs';
import { sortCatalogProducts } from '../js/pages/catalog/politica-exhibicion-catalogo.js';
import { normalizeCollectionSlug, firstEligibleCollectionProduct } from '../js/core/store/colecciones-publicas.mjs';
import { sanitizeImageUrl } from '../js/components/images/utilidades-imagenes.js';

// Pool completo y una URL de portada por categoría, sin descripciones
// ni matrices de variantes de productos que no se van a pintar.
export function homeProductIndex(items, {baseUrl = 'https://media.invalid/'} = {}) {
  const products = items.map(({id, data}) => ({...data, id,
    name: data.name || data.title || data.Title || data.handle || data.Handle || '',
    category: normalizeCollectionSlug(data.category || data.collectionSlug || data.collection || data.cat || data.type || data.Type || data['Product Category'] || data.Category || ''),
    imageUrl: sanitizeImageUrl(data.imageUrl || data.image || data.img || data.photo || data.imageSrc || data.image_src || data['Image Src'] || data['Variant Image'] || '', {baseUrl}),
    price: Number(String(data.price || data.Price || data['Variant Price'] || 0).replace(/\./g, '').replace(',', '.')),
  })).filter(product => hasPublicProductFields(product));
  const groups = new Map();
  for (const product of products) {
    if (!groups.has(product.category)) groups.set(product.category, []);
    groups.get(product.category).push(product);
  }
  const covers = new Set([...groups].map(([category,group]) => firstEligibleCollectionProduct(category,group,Boolean)?.id).filter(Boolean));
  return sortCatalogProducts(products).map(product => ({id: product.id, data: {
    category: product.category, destacado: product.destacado === true, available: hasProductStock(product),
    ...(covers.has(product.id) ? {collectionImage:product.imageUrl} : {}),
  }}));
}

