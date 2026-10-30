import { hasProductStock } from '../js/core/store/inventario-variantes.mjs';
import { hasPublicProductFields } from '../js/core/store/publicacion-producto.mjs';
import { sortCatalogProducts } from '../js/pages/catalog/politica-exhibicion-catalogo.js';
import { wristCategory } from '../js/core/store/categorias-pulseras.mjs';

// El índice permite sortear sobre todo el catálogo sin transferir fotos,
// descripciones ni matrices de variantes de productos que no se van a pintar.
export function homeProductIndex(items) {
  const products = items.map(({id, data}) => ({...data, id,
    name: data.name || data.title || data.Title || data.handle || data.Handle || '',
    category: wristCategory(data.category || data.collectionSlug || data.collection || data.cat || data.type || data.Type || data['Product Category'] || data.Category || ''),
    price: Number(String(data.price || data.Price || data['Variant Price'] || 0).replace(/\./g, '').replace(',', '.')),
  })).filter(product => hasPublicProductFields(product));
  return sortCatalogProducts(products).map(product => ({id: product.id, data: {category: product.category, destacado: product.destacado === true, available: hasProductStock(product)}}));
}

