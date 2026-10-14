// Alias de lectura: conserva documentos y productos históricos sin migrarlos.
export function wristCategory(value) {
  const key = String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /^(pulseras?|brazaletes?|bracelets?|bangles?|esclavas?)$/.test(key) ? 'pulseras' : value;
}

export function unifyWristCollections(collections, canonicalSlug = true) {
  const wrist = collections.filter(item => wristCategory(item.slug) === 'pulseras');
  const preferred = wrist.find(item => item.slug === 'pulseras') || wrist[0];
  if (!preferred) return collections.slice();
  return collections.filter(item => wristCategory(item.slug) !== 'pulseras').concat({
    ...preferred,
    slug: canonicalSlug ? 'pulseras' : preferred.slug,
    name: 'Pulseras',
    sourceSlugs: wrist.map(item => item.slug),
    image: preferred.image || wrist.find(item => item.image)?.image || '',
  });
}
