import {variantInventoryEntries, variantInventoryTotal, reorderVariantInventory, assertVariantCompatibility, variantAttributes, attributesKey} from '../../core/store/inventario-variantes.mjs?v=tintin-20261023-variant-engine-v2-2';

// Borrador del editor: las identidades y los cálculos siguen en el motor compartido.
export function commercialDraft(product, variants = product.variants, protectedProduct=product) {
  const prior = variantInventoryEntries(product);
  const base = {...product, variants};
  const protectedKeys=new Set((variantInventoryEntries(protectedProduct || {}) || []).map(row=>row.variant));
  const retained=(prior || []).filter(row=>{
    const attrs=row.attributes || variantAttributes(product,row.variant);
    return protectedKeys.has(row.variant) || Object.entries(variants).every(([key,values])=>values.includes(attrs?.[key]));
  });
  const rows = reorderVariantInventory(product, variants, retained);
  base.variantCommerceVersion = 2;
  base.variantInventory = rows.map(row => {
    const attributes=row.attributes || variantAttributes({...product,variants},row.variant);
    const existing=prior?.find(entry=>attributesKey(entry.attributes || variantAttributes(product,entry.variant))===attributesKey(attributes));
    return {...row,variant:existing?.variant || `v_${crypto.randomUUID().replaceAll('-','')}`,attributes,stock:row.stock===''?0:row.stock};
  });
  base.stock = variantInventoryTotal(variantInventoryEntries(base));
  assertVariantCompatibility(protectedProduct, base);
  return base;
}

export function commercialPatch(before, draft) {
  const next = {...before, ...draft};
  next.variantInventory = variantInventoryEntries(next);
  next.stock = variantInventoryTotal(next.variantInventory);
  assertVariantCompatibility(before, next);
  if(before?.variantCommerceVersion!==2){
    for(const old of variantInventoryEntries(before || {}) || []){
      const row=next.variantInventory.find(item=>item.variant===old.variant);
      if(!row || row.stock===null || attributesKey(row.attributes)!==attributesKey(variantAttributes(before,old.variant)))throw Error('Conservá las referencias y el control de stock del inventario anterior.');
    }
  }
  return {variantCommerceVersion:2, variants:next.variants, variantInventory:next.variantInventory, stock:next.stock};
}

// Retiring an option is reversible availability, never deletion of a reserved
// identity or transfer of its stock/price to another combination.
export function setCommercialOptionAvailability(product, attribute, value, active, persisted = product) {
  if (typeof active !== 'boolean') throw new Error('Disponibilidad inválida.');
  let matched = false;
  const rows = variantInventoryEntries(product).map(row => {
    if (row.attributes?.[attribute] !== value) return row;
    matched = true;
    return {...row, active};
  });
  if (!matched) throw new Error('La opción seleccionada ya no existe.');
  const next = {...product, variantInventory:rows};
  return {...next, ...commercialPatch(persisted, next)};
}
