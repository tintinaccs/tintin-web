import { variantInventoryEntries,assertVariantCompatibility } from '../../core/store/inventario-variantes.mjs?v=tintin-20261031-seo-espacios-2';
// Contrato de las operaciones del maestro; Firestore y permisos se inyectan desde Admin.
const FIELDS = ['name','sku','category','collection','price','priceBefore','stock','active','oferta','destacado','badge','description','desc','image','imageUrl','imagesExtra','variantMedia','variants','variantInventory','variantCommerceVersion','tags','material','measurements','colorFinish','care','waterResistance','warranty','sizeFit','packageContents','publicationStatus','productTemplate','seoTitle','seoDescription'];
export const PRODUCT_BULK_FIELDS = ['price','pricePercent','priceBefore','stock','stockDelta','category','active','oferta','destacado','badge','tags'];
function stable(value) {
  if(Array.isArray(value)) return value.map(stable);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value ?? null;
}
export function productFingerprint(product) {
  return JSON.stringify(stable(Object.fromEntries(FIELDS.map(field=>[field,product?.[field] ?? null]))));
}
function integer(value,min,max,label) {
  if(!['string','number'].includes(typeof value) || (typeof value==='string' && !value.trim()) || !Number.isInteger(Number(value)) || Number(value)<min || Number(value)>max) throw Error(`${label}: ingresá un entero entre ${min} y ${max}.`);
  return Number(value);
}
export function productBulkPatch(product,field,value,collections=[]) {
  if(!PRODUCT_BULK_FIELDS.includes(field)) throw Error('Acción de producto no válida.');
  const patch={};
  if(field==='price' || field==='pricePercent') {
    const price=field==='price' ? integer(value,1,1000000000,'Precio') : Math.round(integer(product.price,1,1000000000,'Precio actual')*(100+integer(value,-99,1000,'Porcentaje'))/100);
    if(price<1 || price>1000000000) throw Error('El precio resultante está fuera de rango.');
    patch.price=price;
    if(product.priceBefore!=null && (!Number.isFinite(Number(product.priceBefore)) || Number(product.priceBefore)<=price)) patch.priceBefore=null;
  } else if(field==='priceBefore') {
    patch.priceBefore=value==='' || value==null ? null : integer(value,1,1000000000,'Precio anterior');
    if(patch.priceBefore!=null && patch.priceBefore<=Number(product.price)) throw Error('El precio anterior debe superar el precio actual de todos los productos.');
  } else if(field==='stock' || field==='stockDelta') {
    if(product.variantInventory!=null) throw Error('El stock por variante se modifica desde Editar producto, opción por opción.');
    if(field==='stock') patch.stock=value==='' || value==null ? null : integer(value,0,1000000,'Stock');
    else {
      if(product.stock==null) throw Error('No se puede sumar o restar a un stock sin control.');
      patch.stock=integer(product.stock,0,1000000,'Stock actual')+integer(value,-1000000,1000000,'Ajuste de stock');
      if(patch.stock<0 || patch.stock>1000000) throw Error('El stock resultante está fuera de rango.');
    }
  } else if(field==='category') {
    if(typeof value!=='string' || !collections.some(item=>(item.slug || item.id)===value)) throw Error('La colección no existe. Actualizá la lista.');
    patch.category=value;
  } else if(['active','oferta','destacado'].includes(field)) {
    if(typeof value!=='boolean') throw Error('Elegí Sí o No.');
    patch[field]=value;
    if(field==='oferta' && value===false){if(product.priceBefore!=null)patch.priceBefore=null;if(product.badge==='Oferta')patch.badge=null;}
  } else if(field==='badge') {
    if(!['','Nuevo','Destacado','Oferta','Agotado'].includes(value)) throw Error('Etiqueta no válida.');
    patch.badge=value || null;
  } else if(field==='tags') {
    if(typeof value!=='string' || value.length>2000) throw Error('Etiquetas no válidas.');
    const tags=[...new Set(value.split(',').map(tag=>tag.trim()).filter(Boolean))];
    if(tags.length>30 || tags.some(tag=>tag.length>60)) throw Error('Usá hasta 30 etiquetas de hasta 60 caracteres.');
    patch.tags=tags;
  }
  if(field==='active' && product.publicationStatus)patch.publicationStatus=value?'active':product.publicationStatus==='archived'?'archived':'draft';
  if(product.variantCommerceVersion===2){variantInventoryEntries({...product,...patch});assertVariantCompatibility(product,{...product,...patch});}
  return patch;
}
export function productBulkIds(ids) {
  if(!Array.isArray(ids) || !ids.length || ids.length>30 || new Set(ids).size!==ids.length || ids.some(id=>typeof id!=='string' || !id || id.length>180 || id.includes('/'))) throw Error('Seleccioná entre 1 y 30 productos distintos.');
  return ids;
}
export async function applyProductBulkTransaction(transaction,request,collections,refForId,timestamp) {
  const ids=productBulkIds(request.ids);
  const snapshots=[];
  // Todas las lecturas y validaciones preceden a la primera escritura.
  for(const id of ids) snapshots.push(await transaction.get(refForId(id)));
  const changes=snapshots.map((snapshot,index)=>{
    if(!snapshot.exists()) throw Error('Un producto ya no existe. Actualizá la lista.');
    const before=snapshot.data(),id=ids[index];
    if(!Object.hasOwn(request.expected || {},id) || request.expected[id]!==productFingerprint(before)) throw Error('Un producto cambió en otra sesión. Actualizá y revisá la selección.');
    return {id,before,patch:productBulkPatch(before,request.field,request.value,collections)};
  });
  for(const change of changes) {
    const stockOnly = Object.keys(change.patch).every(key => key === 'stock' || key === 'variantInventory');
    transaction.update(refForId(change.id),{...change.patch,updatedAt:timestamp(),...(stockOnly ? {restockedAt:timestamp()} : {merchandisingUpdatedAt:timestamp()})});
  }
  return changes;
}
export function productDuplicateData(product) {
  const copy=Object.fromEntries(FIELDS.filter(field=>Object.hasOwn(product,field)).map(field=>[field,structuredClone(product[field])]));
  copy.name=`${String(product.name || 'Producto').slice(0,170)} (copia)`;
  if(Array.isArray(copy.variants))copy.variants=copy.variants.map(row=>row && typeof row==='object'?Object.fromEntries(Object.entries(row).filter(([key])=>key!=='sku')):row);
  if(copy.publicationStatus)copy.publicationStatus='draft';
  copy.sku='';copy.active=false;copy.oferta=false;copy.destacado=false;copy.badge=null;copy.priceBefore=null;copy.stock=0;
  if(Array.isArray(product.variantInventory)) copy.variantInventory=product.variantInventory.map(entry=>product.variantCommerceVersion===2?{...structuredClone(entry),stock:0}:{variant:entry.variant,stock:0});
  return copy;
}

// Una edición puntual mantiene el total igual a la suma de sus variantes.
export function productCardPatch(product, request, collections = []) {
  if (product.variantCommerceVersion === 2) throw Error('La edición comercial v2 requiere el editor compatible.');
  if (request.field === 'category') return productBulkPatch(product, 'category', request.value, collections);
  if (['active', 'oferta', 'destacado'].includes(request.field)) return productBulkPatch(product, request.field, request.value);
  if (request.field !== 'stock') throw Error('Campo de tarjeta no válido.');
  const quantity = integer(request.value, 0, 1000000, 'Stock');
  const entries = variantInventoryEntries(product);
  if (entries === null) {
    if (request.variant) throw Error('Este producto todavía no tiene inventario por variante. Usá Editar producto para distribuirlo.');
    return {stock: quantity};
  }
  if (!entries.some(entry => entry.variant === request.variant)) throw Error('Elegí una variante válida.');
  const variantInventory = entries.map(entry => entry.variant === request.variant ? {...entry, stock: quantity} : entry);
  const stock = variantInventory.reduce((sum, entry) => sum + entry.stock, 0);
  if (stock > 1000000) throw Error('El stock total supera el límite permitido.');
  return {variantInventory, stock};
}
