export const CHECKOUT_DRAFT_KEYS = Object.freeze([
  'requestId', 'cartLines', 'name', 'phone', 'contactEmail', 'notes',
  'selectedCity', 'departamento', 'address', 'referencia', 'mapLocation',
  'shippingMethod', 'encomiendaMode', 'paymentMethod', 'expectedSubtotal',
  'expectedShippingCost', 'expectedShippingPending', 'expectedTotal',
  'wantsInvoice', 'razonSocial', 'ruc', 'ci', 'couponCode', 'expectedDiscount'
]);

const clean = value => String(value == null ? '' : value).trim();

export function aggregateCheckoutCart(items) {
  // La unidad lógica es producto + variante. Agrupar sólo por id mezclaba,
  // por ejemplo, 2 anillos talle 6 + 1 talle 7 en una sola línea de qty 3.
  const byLine = new Map();
  for (const item of items || []) {
    const id = clean(item?.id);
    const variant = clean(item?.variant);
    const qty = Number(item?.qty || 1);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw Object.assign(new Error('Encontramos una cantidad no válida en el carrito.'), { code: 'invalid_cart' });
    }
    const key = `${id}\u241f${variant}`;
    const existing = byLine.get(key);
    if (existing) existing.qty += qty;
    else byLine.set(key, { id, qty, variant });
  }
  const result = [...byLine.values()];
  if (result.some(item => item.qty > 99)) {
    throw Object.assign(new Error('La cantidad de una variante es demasiado alta.'), { code: 'invalid_cart' });
  }
  return result;
}

export function composeCheckoutDraft(input) {
  const shippingCost = input.shipping.cost == null ? 0 : input.shipping.cost;
  const discount = Math.max(0, Math.round(input.discount || 0));
  const couponCode = clean(input.couponCode).toUpperCase();
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
    expectedTotal: Math.round(input.subtotal - discount + shippingCost),
    // Factura (razonSocial/ruc) es un pedido explícito de la clienta, nunca
    // obligatorio. CI sólo se pide para encomienda porque la transportadora
    // lo exige para el retiro/entrega — si además pide factura, van los tres.
    wantsInvoice: Boolean(input.wantsInvoice),
    razonSocial: input.wantsInvoice ? String(input.razonSocial || '') : '',
    ruc: input.wantsInvoice ? String(input.ruc || '') : '',
    ci: input.shipping.method === 'encomienda' ? String(input.ci || '') : '',
    couponCode,
    expectedDiscount: couponCode ? discount : 0
  };
}
