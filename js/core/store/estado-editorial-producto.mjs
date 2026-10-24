export const PRODUCT_STATUSES = Object.freeze(['active','draft','archived']);
export const PRODUCT_TEMPLATES = Object.freeze(['default','gallery']);
export function productEditorialStatus(product) {
  return PRODUCT_STATUSES.includes(product?.publicationStatus) ? product.publicationStatus : product?.active===false?'draft':'active';
}
export function productIsPublished(product) {
  return product?.active!==false && productEditorialStatus(product)==='active';
}
export function productTemplate(product) {
  return PRODUCT_TEMPLATES.includes(product?.productTemplate)?product.productTemplate:'default';
}
export function editorialFields(input) {
  if(!PRODUCT_STATUSES.includes(input.publicationStatus))throw Error('Estado del producto inválido.');
  if(!PRODUCT_TEMPLATES.includes(input.productTemplate))throw Error('Plantilla del producto inválida.');
  const result={publicationStatus:input.publicationStatus,active:input.publicationStatus==='active',productTemplate:input.productTemplate};
  for(const [key,max] of [['seoTitle',70],['seoDescription',220]]) {
    if(typeof input[key]!=='string' || input[key].length>max || /[<>\u0000-\u001f]/.test(input[key]))throw Error('Texto SEO inválido.');
    result[key]=input[key].trim();
  }
  return result;
}
