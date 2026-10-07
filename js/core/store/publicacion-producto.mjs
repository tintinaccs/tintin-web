// Contrato estructural compartido entre catálogo y metadata/sitemap del servidor.
// La visibilidad de la colección sigue siendo responsabilidad del catálogo.
export function hasPublicProductFields(product) {
  const p = product || {};
  const text = value => String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim();
  const price = Number(p.price);
  const stock = p.stock == null || p.stock === '' ? null : Number(p.stock);
  return Boolean(text(p.id) && text(p.name) && text(p.category || p.cat)
    && p.active !== false && Number.isFinite(price) && Math.round(price) > 0
    && Math.round(price) <= 1_000_000_000 && (stock == null || Number.isFinite(stock)));
}
