import { isValidUsername, normalizeUsername } from '../../components/forms/utilidades-username.js?v=tintin-20260821-username-unique-1';
import { isValidDob, parseDob } from '../../components/forms/validacion-nacimiento.js?v=tintin-20260822-dob-username-onboarding-1';

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

/**
 * ¿Hay una ubicación que el checkout pueda reutilizar?
 *
 * El formato es el que el checkout ya venía guardando desde "Guardar esta
 * ubicación en mi perfil": `savedLocation {lat, lng, name, address}`. El alta
 * de la cuenta escribe exactamente ese campo, así que una ubicación cargada
 * en cualquiera de los dos lados sirve en el otro y no se vuelve a pedir.
 * `maybeApplySavedLocation()` del checkout además exige `name`.
 */
export function hasUsableAddress(profile = {}) {
  const saved = profile.savedLocation;
  if (!saved || !clean(saved.name)) return false;
  const lat = Number(saved.lat);
  const lng = Number(saved.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/** Convierte un resultado del buscador al formato `savedLocation`. */
export function toSavedLocation(place = {}) {
  const lat = Number(place.addressLat ?? place.lat);
  const lng = Number(place.addressLng ?? place.lng);
  const name = clean(place.addressName || place.name);
  const address = clean(place.address);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name, ...(address ? { address } : {}) };
}

function exposeSavedLocationForOnboarding(profile = {}) {
  if (typeof globalThis === 'undefined') return;
  const savedLocation = hasUsableAddress(profile)
    ? toSavedLocation(profile.savedLocation)
    : null;
  globalThis.TintinOnboardingSavedLocation = savedLocation;
}

function locationsAreEqual(first, second) {
  if (!first || !second) return false;
  return Number(first.lat).toFixed(6) === Number(second.lat).toFixed(6) &&
    Number(first.lng).toFixed(6) === Number(second.lng).toFixed(6) &&
    clean(first.name) === clean(second.name) &&
    clean(first.address) === clean(second.address);
}

/**
 * Qué le falta a este perfil para estar completo.
 *
 * Cuando el alta se abre por nombre o teléfono faltante, también se muestra
 * la ubicación. Si ya estaba guardada se carga marcada y no se vuelve a pedir;
 * así la persona confirma todos los datos útiles para comprar en una sola
 * pantalla y checkout puede reutilizarlos sin otro paso obligatorio.
 */
export function getProfileCompletionPlan({ profile = {}, user = {}, role = '', superAdminEmail = '', requireAddress = true } = {}) {
  if (isSuperAdminProfile({ email: user.email, role }, superAdminEmail)) {
    exposeSavedLocationForOnboarding({});
    return {
      skip: true, needsName: false, needsPhone: false, needsAddress: false,
      needsUsername: false, needsDob: false,
      suggestedName: '', suggestedFirstName: '', suggestedLastName: '',
    };
  }

  const stored = readProfileName(profile);
  const storedNameIsValid = isValidFullName(stored.firstName, stored.lastName);
  const storedPhone = clean(profile.phone);
  const addressOk = !requireAddress || hasUsableAddress(profile);
  const needsName = !storedNameIsValid;
  const needsPhone = !storedPhone;
  const addressMissing = !addressOk;
  // Username y fecha de nacimiento sólo se piden a cuentas nuevas marcadas
  // explícitamente `incomplete` (creadas después de este cambio). Cuentas
  // `legacy` o sin `profileStatus` (anteriores al contrato de identidad) no
  // los tenían antes y no se les inventa ninguno acá — mismo criterio que ya
  // aplica al nombre/teléfono/dirección para esas cuentas.
  const needsUsername = profile.profileStatus === 'incomplete' && !isValidUsername(profile.username);
  const needsDob = profile.profileStatus === 'incomplete' && !profile.dob;
  const onboardingRequired = needsName || needsPhone || addressMissing || needsUsername || needsDob;

  exposeSavedLocationForOnboarding(profile);

  // Lo que sugerimos: primero lo guardado, y si no sirve, lo que dio Google.
  const fromProvider = splitFullName(user.displayName);
  const suggestedFirstName = isValidNamePart(stored.firstName) ? stored.firstName
    : (isValidNamePart(fromProvider.firstName) ? fromProvider.firstName : '');
  const suggestedLastName = isValidNamePart(stored.lastName) ? stored.lastName
    : (isValidNamePart(fromProvider.lastName) ? fromProvider.lastName : '');

  return {
    skip: !onboardingRequired,
    needsName,
    needsPhone,
    // Si el alta está abierta, se muestra el mapa aunque la ubicación ya esté
    // guardada. mapa-ubicacion.js la precarga y permite continuar sin tocarla.
    needsAddress: onboardingRequired && requireAddress,
    addressAlreadySaved: addressOk,
    needsUsername,
    needsDob,
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
  submittedUsername = '',
  submittedDob = '',
  explicitNameChange = false,
} = {}) {
  const patch = {};
  const current = readProfileName(currentProfile);
  const currentNameIsValid = isValidFullName(current.firstName, current.lastName);
  const currentPhone = clean(currentProfile.phone);
  const currentUsername = clean(currentProfile.username);

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

  if (submittedAddress) {
    const savedLocation = toSavedLocation(submittedAddress);
    const currentSavedLocation = hasUsableAddress(currentProfile)
      ? toSavedLocation(currentProfile.savedLocation)
      : null;

    if (savedLocation && !locationsAreEqual(savedLocation, currentSavedLocation)) {
      patch.savedLocation = savedLocation;
      // `address` es el texto que checkout usa para prellenar la dirección.
      patch.address = savedLocation.address || savedLocation.name;
    }
  }

  // El username lo reserva login.html en `usernameReservations` ANTES de
  // llamar acá (mismo patrón que el teléfono); esta función sólo decide si
  // hace falta guardarlo, nunca lo reserva ni lo valida contra Firestore.
  if (!isValidUsername(currentUsername) && isValidUsername(submittedUsername)) {
    patch.username = normalizeUsername(submittedUsername);
  }

  // La edad no se persiste calculada — sólo la fecha de nacimiento. Se
  // recalcula desde `dob` cada vez que hace falta (ver validacion-nacimiento.js).
  if (!currentProfile.dob && isValidDob(submittedDob)) {
    patch.dob = parseDob(submittedDob);
  }

  // Perfiles nuevos ('incomplete') pasan a 'active' en cuanto tienen nombre,
  // teléfono, username y fecha de nacimiento válidos, ya sea porque ya los
  // tenían guardados o porque se acaban de completar en este mismo alta. La
  // dirección ayuda a comprar pero no bloquea el pasaje a 'active': checkout
  // la vuelve a pedir si todavía falta. Los perfiles 'legacy' no se tocan acá
  // — no se les exige username ni DOB retroactivamente.
  if (currentProfile.profileStatus === 'incomplete') {
    const finalFirstName = patch.firstName || current.firstName;
    const finalLastName = patch.lastName || current.lastName;
    const finalPhone = patch.phone || currentPhone;
    const finalUsername = patch.username || currentUsername;
    const finalDob = patch.dob || currentProfile.dob;
    if (isValidFullName(finalFirstName, finalLastName) && finalPhone &&
        isValidUsername(finalUsername) && finalDob) {
      patch.profileStatus = 'active';
    }
  }

  return patch;
}
