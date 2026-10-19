// Prepara un borrador. La autoridad de totales/reservas sigue en admin-order-mutation.
export function mergeSelectedOrderProducts(items,products) {
  const result=(items || []).map(item=>({...item,id:item.id || item.productId || '',qty:Number(item.qty ?? item.quantity ?? 1)}));
  if(!Array.isArray(products) || products.length>30 || new Set(products.map(p=>p.id)).size!==products.length)throw Error('Selección de productos inválida.');
  for(const product of products){
    if(!product?.id || product.active===false || !Number.isFinite(Number(product.price)) || Number(product.price)<0)throw Error('Un producto fue eliminado, está inactivo o no tiene un precio válido. Actualizá la selección.');
    const existing=product.variantInventory==null ? result.find(item=>item.id===product.id && !item.variant) : null;
    if(existing){if(!Number.isInteger(existing.qty) || existing.qty>=99)throw Error('Una línea ya alcanzó la cantidad máxima de 99 unidades. Revisá el pedido.');existing.qty++;}
    else result.push({id:product.id,name:product.name || product.id,cat:product.category || '',price:Number(product.price),qty:1,variant:'',imageUrl:product.imageUrl || product.image || ''});
  }
  if(result.length>250 || new Set(result.map(item=>item.id)).size>100)throw Error('El pedido supera el límite de líneas o productos distintos.');
  return result;
}
