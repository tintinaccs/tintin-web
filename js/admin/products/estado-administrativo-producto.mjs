import {productIsPublished} from '../../core/store/estado-editorial-producto.mjs?v=tintin-20261024-editor-v2-6';
export {productIsPublished};
// Etiqueta administrativa, no un cuarto estado persistido ni una migración.
export function productAdminState(product) {
  if(product?.publicationStatus==='draft' || product?.publicationStatus==='archived')return product.publicationStatus;
  return productIsPublished(product)?'active':'inactive';
}
