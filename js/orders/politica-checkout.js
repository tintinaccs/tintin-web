export const CHECKOUT_DRAFT_KEYS = Object.freeze([
  'requestId', 'cartLines', 'name', 'phone', 'contactEmail', 'notes',
  'selectedCity', 'departamento', 'address', 'referencia', 'mapLocation',
  'shippingMethod', 'encomiendaMode', 'paymentMethod', 'expectedSubtotal',
  'expectedShippingCost', 'expectedShippingPending', 'expectedTotal'
]);

const clean = value => String(value == null ? '' : value).trim();

export function aggregateCheckoutCart(items) {
  const byProduct = new Map();
  for (const item of items || []) {
    const id = clean(item?.id);
    const qty = Number(item?.qty || 1);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw Object.assign(new Error('Encontramos una cantidad no válida en el carrito'), { code: 'invalid_cart' });
    }
    const variant = clean(item?.variant);
    const existing = byProduct.get(id);
    if (existing) {
      existing.qty += qty;
      if (variant && !existing.variants.includes(variant)) existing.variants.push(variant);
    } else {
      byProduct.set(id, { id, qty, variants: variant ? [variant] : [] });
    }
  }
  const result = [...byProduct.values()];
  if (result.some(item => item.qty > 99)) {
    throw Object.assign(new Error('La cantidad de uno de los productos es demasiado alta'), { code: 'invalid_cart' });
  }
  return result;
}

export function composeCheckoutDraft(input) {
  const shippingCost = input.shipping.cost == null ? 0 : input.shipping.cost;
  return {
    requestId: input.requestId,
    cartLines: aggregateCheckoutCart(input.items),
    name: input.name,
    phone: input.phone,
    contactEmail: input.contactEmail,
    notes: input.notes,
    selectedCity: input.selectedCity,
    departamento: input.departamento,
    address: input.address,
    referencia: input.referencia,
    mapLocation: input.shipping.mapLocation,
    shippingMethod: input.shipping.method,
    encomiendaMode: input.shipping.encomiendaMode || '',
    paymentMethod: input.paymentMethod,
    expectedSubtotal: Math.round(input.subtotal),
    expectedShippingCost: Math.round(shippingCost),
    expectedShippingPending: input.shipping.pending,
    expectedTotal: Math.round(input.subtotal + shippingCost)
  };
}
