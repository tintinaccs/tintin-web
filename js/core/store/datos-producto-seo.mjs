import {hasProductStock, productDefaultPrice, variantOffers, variantInventoryEntries} from './inventario-variantes.mjs?v=tintin-20261031-seo-espacios-2';
import {productVariantImage} from '../../components/images/foto-variante.mjs?v=tintin-20261031-seo-espacios-2';

export function productAvailability(product, available = hasProductStock(product)) {
  if (!available) return 'OutOfStock';
  return /bajo pedido/i.test(product.description || product.desc || '') ? 'PreOrder' : 'InStock';
}

// Una entidad y una oferta, compartidas por HTML inicial y actualizaciones.
// La tienda es el vendedor; no se inventan fabricante, SKU, GTIN ni reseñas.
export function productStructuredData(product, {canonical, images = []} = {}) {
  canonical ||= 'https://tintinaccs.com/product?id=' + encodeURIComponent(product.id);
  const description = String(product.description || product.desc || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const offer = (price, available = hasProductStock(product)) => ({
    '@type':'Offer', url:canonical, priceCurrency:'PYG', price:String(Math.trunc(Number(price))),
    availability:'https://schema.org/' + productAvailability(product, available),
    seller:{'@id':'https://tintinaccs.com/#organization'},
  });
  const data = {'@context':'https://schema.org','@type':'Product','@id':canonical+'#product',
    name:product.name, url:canonical, description, image:images.filter(Boolean),
    ...(product.sku ? {sku:String(product.sku)} : {}),
    ...(product.material ? {material:product.material} : {}),
    ...(product.colorFinish ? {color:product.colorFinish} : {}),
    offers:offer(productDefaultPrice(product).price),
  };
  const variants = variantOffers(product);
  if (variants?.length > 1) {
    data['@type'] = 'ProductGroup';
    data.productGroupID = String(product.id);
    data.variesBy = Object.keys(product.variants || {}).map(key => ({color:'https://schema.org/color',talla:'https://schema.org/size',talle:'https://schema.org/size',material:'https://schema.org/material'}[key.toLowerCase()] || key));
    const entries = variantInventoryEntries(product);
    data.hasVariant = variants.map((variant,index) => ({'@type':'Product',name:product.name+' — '+variant.label,
      ...(variant.sku ? {sku:String(variant.sku)} : {}),
      image:[productVariantImage(product,product.variantCommerceVersion === 2 ? {variantKey:entries[index].variant} : entries[index].variant,images[0])].filter(Boolean),
      isVariantOf:{'@id':data['@id']}, offers:offer(variant.price,variant.available)}));
  }
  return data;
}
