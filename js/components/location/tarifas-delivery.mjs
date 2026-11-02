// La tarifa viene de administración; sólo se normalizan aliases de ciudades.
// No escribe settings ni modifica importes de pedidos existentes.
export function normalizeDeliveryCityName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (/^san lorenzo(?: centro| alrededores)?$/i.test(name)) return 'San Lorenzo';
  if (/^fernando de la mora$/i.test(name)) return 'Fernando de la Mora';
  return name;
}

export function canonicalDeliveryCities(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).flatMap(row => {
    const name = normalizeDeliveryCityName(row?.name);
    const key = name.toLocaleLowerCase('es-PY');
    if (!name || seen.has(key)) return [];
    seen.add(key);
    return [{ ...row, name }];
  });
}

// Ausente es "a confirmar"; cero es una tarifa explícita, nunca un fallback.
export function configuredShippingPrice(value) {
  if (value == null || !['number','string'].includes(typeof value) || typeof value === 'string' && !value.trim()) return null;
  const price = typeof value === 'number' ? value : Number(value.replace(/gs\.?/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isInteger(price) && price >= 0 && price <= 1e9 ? price : null;
}
