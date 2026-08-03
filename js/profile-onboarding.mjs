function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function isSuperAdminProfile({ email = '', role = '' } = {}, superAdminEmail = '') {
  return clean(role).toLowerCase() === 'superadmin' ||
    clean(email).toLowerCase() === clean(superAdminEmail).toLowerCase();
}

// Valores que llegan cuando en realidad no hay un nombre: los manda Google
// cuando el perfil está incompleto, o los escribe alguien para saltear el
// formulario. Guardarlos como si fueran un nombre real ensucia el perfil y
// después aparecen en los pedidos y en los correos al cliente.
const PLACEHOLDER_NAMES = new Set([
  'undefined', 'null', 'nan', 'none', 'nil', 'na', 'n/a', 's/n',
  'usuario', 'user', 'cliente', 'client', 'invitado', 'guest', 'anonimo', 'anónimo',
  'nombre', 'apellido', 'name', 'lastname', 'surname', 'nombre completo',
  'sin nombre', 'sinnombre', 'sin apellido', 'no tengo', 'ninguno',
  'test', 'testing', 'prueba', 'pruebas', 'ejemplo', 'example', 'demo',
  'admin', 'administrador', 'asdf', 'asd', 'qwerty', 'aaa', 'xxx', 'abc',
]);

// Letras de cualquier alfabeto + marcas de acento, más los signos que sí
// aparecen en nombres reales: apóstrofe (D'Angelo), guion (García-López) y
// espacio interno (De la Cruz). Nada de números, emojis ni otros símbolos.
const NAME_ALLOWED = /^[\p{L}][\p{L}\p{M}'’\- ]*$/u;
const LETTER = /\p{L}/gu;

/**
 * ¿Es un nombre o apellido real?
 *
 * Pide al menos dos letras — una sola inicial ("A", "J.") no identifica a
 * nadie, que es justamente lo que devuelve Google cuando el perfil está a
 * medias.
 */
export function isValidNamePart(value) {
  const name = clean(value);
  if (!name) return false;
  if (name.length > 60) return false;
  if (!NAME_ALLOWED.test(name)) return false;
  if ((name.match(LETTER) || []).length < 2) return false;
  if (PLACEHOLDER_NAMES.has(name.toLowerCase())) return false;
  return true;
}

/** Nombre y apellido juntos, sólo si los dos son válidos por separado. */
export function isValidFullName(first, last) {
  return isValidNamePart(first) && isValidNamePart(last);
}

/**
 * Separa en nombre y apellido lo que haya entregado Google (o lo que ya esté
 * guardado en el campo `name` de los perfiles viejos).
 *
 * La primera palabra es el nombre y el resto el apellido: "María José Pérez
 * Duarte" queda como "María" + "José Pérez Duarte". Puede no ser el corte
 * ideal, pero el usuario lo ve en pantalla y lo corrige antes de guardar —
 * nunca se guarda sin que lo confirme.
 */
export function splitFullName(value) {
  const parts = clean(value).split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/** Lee nombre/apellido de un perfil, tolerando los que sólo tienen `name`. */
export function readProfileName(profile = {}) {
  const first = clean(profile.firstName);
  const last = clean(profile.lastName);
  if (first || last) return { firstName: first, lastName: last };
  return splitFullName(profile.name);
}

/** ¿Hay una ubicación utilizable para el checkout (texto + coordenadas)? */
export function hasUsableAddress(profile = {}) {
  const label = clean(profile.address || profile.addressLabel);
  const lat = Number(profile.addressLat);
  const lng = Number(profile.addressLng);
  return Boolean(label) && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/**
 * Qué le falta a este perfil para estar completo.
 *
 * Sólo mira lo que ya está guardado: si el dato existe y es válido, no se
 * vuelve a pedir nunca. Lo que Google haya entregado se ofrece como sugerencia
 * para confirmar, no como dato ya guardado.
 */
export function getProfileCompletionPlan({ profile = {}, user = {}, role = '', superAdminEmail = '', requireAddress = true } = {}) {
  if (isSuperAdminProfile({ email: user.email, role }, superAdminEmail)) {
    return {
      skip: true, needsName: false, needsPhone: false, needsAddress: false,
      suggestedName: '', suggestedFirstName: '', suggestedLastName: '',
    };
  }

  const stored = readProfileName(profile);
  const storedNameIsValid = isValidFullName(stored.firstName, stored.lastName);
  const storedPhone = clean(profile.phone);
  const addressOk = !requireAddress || hasUsableAddress(profile);

  // Lo que sugerimos: primero lo guardado, y si no sirve, lo que dio Google.
  const fromProvider = splitFullName(user.displayName);
  const suggestedFirstName = isValidNamePart(stored.firstName) ? stored.firstName
    : (isValidNamePart(fromProvider.firstName) ? fromProvider.firstName : '');
  const suggestedLastName = isValidNamePart(stored.lastName) ? stored.lastName
    : (isValidNamePart(fromProvider.lastName) ? fromProvider.lastName : '');

  return {
    skip: storedNameIsValid && Boolean(storedPhone) && addressOk,
    needsName: !storedNameIsValid,
    needsPhone: !storedPhone,
    needsAddress: !addressOk,
    suggestedFirstName,
    suggestedLastName,
    suggestedName: clean(`${suggestedFirstName} ${suggestedLastName}`),
  };
}

// Se ejecuta con el perfil vuelto a leer dentro de una transacción. Así un
// dato que otro proceso completó mientras el formulario estaba abierto nunca
// se pisa por accidente.
export function buildMissingProfilePatch({
  currentProfile = {},
  submittedFirstName = '',
  submittedLastName = '',
  submittedName = '',
  submittedPhone = '',
  submittedAddress = null,
  explicitNameChange = false,
} = {}) {
  const patch = {};
  const current = readProfileName(currentProfile);
  const currentNameIsValid = isValidFullName(current.firstName, current.lastName);
  const currentPhone = clean(currentProfile.phone);

  // Compatibilidad: quien todavía mande `submittedName` entero se separa acá.
  const fallback = splitFullName(submittedName);
  const firstName = clean(submittedFirstName) || fallback.firstName;
  const lastName = clean(submittedLastName) || fallback.lastName;

  if ((!currentNameIsValid || explicitNameChange) && isValidFullName(firstName, lastName)) {
    if (firstName !== current.firstName || lastName !== current.lastName) {
      patch.firstName = firstName;
      patch.lastName = lastName;
      // `name` se mantiene porque el resto del sitio (pedidos, correos, admin)
      // todavía lo lee.
      patch.name = `${firstName} ${lastName}`;
    }
  }

  if (!currentPhone && clean(submittedPhone)) patch.phone = clean(submittedPhone);

  if (submittedAddress && !hasUsableAddress(currentProfile) && hasUsableAddress(submittedAddress)) {
    patch.address = clean(submittedAddress.address || submittedAddress.addressLabel);
    patch.addressLat = Number(submittedAddress.addressLat);
    patch.addressLng = Number(submittedAddress.addressLng);
    if (clean(submittedAddress.addressName)) patch.addressName = clean(submittedAddress.addressName);
  }

  return patch;
}
