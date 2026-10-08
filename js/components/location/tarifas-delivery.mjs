// Regla comercial solicitada: se aplica sólo a nuevas cotizaciones.
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
    const fixed = name === 'San Lorenzo' || name === 'Fernando de la Mora';
    return [{ ...row, name, price: fixed ? 25000 : row.price }];
  });
}
