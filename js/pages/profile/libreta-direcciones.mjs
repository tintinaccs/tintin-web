// Libreta de direcciones del perfil: hasta 5 ubicaciones guardadas.
// `savedLocation` sigue siendo la dirección principal (la que lee el checkout
// y el alta); `savedLocations` guarda la lista completa, principal incluida.
export const MAX_SAVED_LOCATIONS = 5;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validLocation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const name = clean(raw.name);
  const address = clean(raw.address);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name, ...(address ? { address } : {}) };
}

export function sameLocation(a, b) {
  if (!a || !b) return false;
  return Number(a.lat).toFixed(6) === Number(b.lat).toFixed(6) &&
    Number(a.lng).toFixed(6) === Number(b.lng).toFixed(6) &&
    clean(a.name) === clean(b.name) &&
    clean(a.address) === clean(b.address);
}

/** Lista normalizada: la principal primero, sin repetidas, máximo 5. */
export function readAddressBook(profile = {}) {
  const primary = validLocation(profile.savedLocation);
  const stored = Array.isArray(profile.savedLocations) ? profile.savedLocations : [];
  const list = [];
  for (const raw of [primary, ...stored]) {
    const loc = validLocation(raw);
    if (loc && !list.some(item => sameLocation(item, loc))) list.push(loc);
  }
  return list.slice(0, MAX_SAVED_LOCATIONS);
}

/** Campos a guardar: la lista y la principal (primer elemento) en espejo. */
export function addressBookPatch(list) {
  const book = list.slice(0, MAX_SAVED_LOCATIONS);
  const primary = book[0] || null;
  return {
    savedLocations: book,
    savedLocation: primary,
    ...(primary ? { address: primary.address || primary.name } : {})
  };
}

/** Agrega una dirección. La primera queda como principal. */
export function addAddress(list, location) {
  const loc = validLocation(location);
  if (!loc) return { ok: false, reason: 'invalid', list };
  if (list.some(item => sameLocation(item, loc))) return { ok: false, reason: 'duplicate', list };
  if (list.length >= MAX_SAVED_LOCATIONS) return { ok: false, reason: 'full', list };
  return { ok: true, list: [...list, loc] };
}

/** Quita la dirección en `index`; si era la principal, pasa la siguiente. */
export function removeAddress(list, index) {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

/** Mueve la dirección en `index` al primer lugar (principal). */
export function makePrimary(list, index) {
  if (!Number.isInteger(index) || index <= 0 || index >= list.length) return list;
  return [list[index], ...list.filter((_, i) => i !== index)];
}
