import { isValidUsername, normalizeUsername } from '../../components/forms/utilidades-username.js?v=tintin-20260821-username-unique-1';
import { isValidDob, parseDob } from '../../components/forms/validacion-nacimiento.js?v=tintin-20260822-dob-username-onboarding-1';

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function isSuperAdminProfile({ email = '', role = '' } = {}, superAdminEmail = '') {
  return clean(role).toLowerCase() === 'superadmin' ||
    clean(email).toLowerCase() === clean(superAdminEmail).toLowerCase();
}

const PLACEHOLDER_NAMES = new Set([
  'undefined', 'null', 'nan', 'none', 'nil', 'na', 'n/a', 's/n',
  'usuario', 'user', 'cliente', 'client', 'invitado', 'guest', 'anonimo', 'anónimo',
  'nombre', 'apellido', 'name', 'lastname', 'surname', 'nombre completo',
  'sin nombre', 'sinnombre', 'sin apellido', 'no tengo', 'ninguno',
  'test', 'testing', 'prueba', 'pruebas', 'ejemplo', 'example', 'demo',
  'admin', 'administrador', 'asdf', 'asd', 'qwerty', 'aaa', 'xxx', 'abc',
]);

const NAME_ALLOWED = /^[\p{L}][\p{L}\p{M}'’\- ]*$/u;
const LETTER = /\p{L}/gu;

export function isValidNamePart(value) {
  const name = clean(value);
  if (!name || name.length > 60 || !NAME_ALLOWED.test(name)) return false;
  if ((name.match(LETTER) || []).length < 2) return false;
  return !PLACEHOLDER_NAMES.has(name.toLowerCase());
}

export function isValidFullName(first, last) {
  return isValidNamePart(first) && isValidNamePart(last);
}

export function splitFullName(value) {
  const parts = clean(value).split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function readProfileName(profile = {}) {
  const first = clean(profile.firstName || profile.first_name || profile.nombre);
  const last = clean(profile.lastName || profile.last_name || profile.apellido);
  if (first || last) return { firstName: first, lastName: last };
  return splitFullName(profile.name || profile.fullName || profile.nombreCompleto);
}

function locationCandidates(profile = {}) {
  return [
    profile.savedLocation,
    profile.location,
    profile.mapLocation,
    profile.deliveryLocation,
    profile.defaultLocation,
    profile.coordinates,
    profile.coords,
    {
      lat: profile.addressLat ?? profile.latitude,
      lng: profile.addressLng ?? profile.longitude ?? profile.longitud,
      name: profile.locationName ?? profile.addressName ?? profile.nombreUbicacion,
      address: profile.address ?? profile.direccion,
    },
  ].filter(candidate => candidate && typeof candidate === 'object');
}

function normalizeStoredLocation(candidate = {}, profile = {}) {
  const geoPoint = candidate.geoPoint || candidate.geopoint || candidate.point || {};
  const coordinates = candidate.coordinates || candidate.coords || {};
  const lat = candidate.lat ?? candidate.latitude ?? candidate.latitud ?? candidate.addressLat ??
    coordinates.lat ?? coordinates.latitude ?? geoPoint.latitude;
  const lng = candidate.lng ?? candidate.longitude ?? candidate.addressLng ??
    coordinates.lng ?? coordinates.longitude ?? geoPoint.longitude;
  const name = clean(candidate.name ?? candidate.locationName ?? candidate.addressName ??
    candidate.label ?? candidate.title ?? profile.locationName ?? profile.addressName);
  const address = clean(candidate.address ?? candidate.formattedAddress ?? candidate.displayName ??
    profile.address ?? profile.direccion);
  return { lat, lng, name, ...(address ? { address } : {}) };
}

function storedLocation(profile = {}) {
  const candidates = locationCandidates(profile);
  return candidates
    .map(candidate => normalizeStoredLocation(candidate, profile))
    .find(candidate => clean(candidate.name) && Number.isFinite(Number(candidate.lat)) &&
      Number.isFinite(Number(candidate.lng)) && (Number(candidate.lat) !== 0 || Number(candidate.lng) !== 0)) ||
    normalizeStoredLocation(candidates[0] || {}, profile);
}

export function hasUsableAddress(profile = {}) {
  return locationCandidates(profile).some(candidate => {
    const saved = normalizeStoredLocation(candidate, profile);
    if (!saved || !clean(saved.name)) return false;
    const lat = Number(saved.lat);
    const lng = Number(saved.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  });
}

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasUsableDob(profile = {}) {
  const date = asDate(
    profile.dob || profile.birthDate || profile.dateOfBirth ||
    profile.fechaNacimiento || profile.fecha_nacimiento
  );
  return !!date && isValidDob(date.toISOString().slice(0, 10));
}

function storedPhoneValue(profile = {}) {
  return clean(
    profile.phone || profile.phoneNumber || profile.whatsapp ||
    profile.whatsappNumber || profile.telefono || profile.celular
  );
}

function storedUsername(profile = {}) {
  return clean(profile.username || profile.userName || profile.nombreUsuario || profile.nombre_usuario);
}

export function toSavedLocation(place = {}) {
  const normalized = normalizeStoredLocation(place);
  const lat = Number(normalized.lat);
  const lng = Number(normalized.lng);
  const name = clean(normalized.name);
  const address = clean(normalized.address);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name, ...(address ? { address } : {}) };
}

function exposeSavedLocationForOnboarding(profile = {}) {
  if (typeof globalThis === 'undefined') return;
  globalThis.TintinOnboardingSavedLocation = hasUsableAddress(profile)
    ? toSavedLocation(storedLocation(profile))
    : null;
}

function locationsAreEqual(first, second) {
  if (!first || !second) return false;
  return Number(first.lat).toFixed(6) === Number(second.lat).toFixed(6) &&
    Number(first.lng).toFixed(6) === Number(second.lng).toFixed(6) &&
    clean(first.name) === clean(second.name) &&
    clean(first.address) === clean(second.address);
}

function hasPersistedCompletion(profile = {}) {
  return profile.onboardingCompleted === true ||
    profile.profileCompleted === true ||
    Boolean(
      profile.onboardingCompletedAt ||
      profile.profileCompletedAt ||
      profile.welcomeTutorialCompletedAt ||
      profile.welcomeTutorialSeen
    );
}

function profileIsCompleteByFields(profile = {}, requireAddress = true) {
  const stored = readProfileName(profile);
  return isValidFullName(stored.firstName, stored.lastName) &&
    Boolean(storedPhoneValue(profile)) &&
    isValidUsername(storedUsername(profile)) &&
    hasUsableDob(profile) &&
    (!requireAddress || hasUsableAddress(profile));
}

export function getProfileCompletionPlan({
  profile = {},
  user = {},
  role = '',
  superAdminEmail = '',
  requireAddress = true,
} = {}) {
  if (isSuperAdminProfile({ email: user.email, role }, superAdminEmail)) {
    exposeSavedLocationForOnboarding({});
    return {
      skip: true,
      needsName: false,
      needsPhone: false,
      needsAddress: false,
      needsUsername: false,
      needsDob: false,
      suggestedName: '',
      suggestedFirstName: '',
      suggestedLastName: '',
    };
  }

  if (clean(profile.profileStatus).toLowerCase() === 'active' || hasPersistedCompletion(profile)) {
    exposeSavedLocationForOnboarding(profile);
    return {
      skip: true,
      needsName: false,
      needsPhone: false,
      needsAddress: false,
      needsUsername: false,
      needsDob: false,
      addressAlreadySaved: hasUsableAddress(profile),
      suggestedName: '',
      suggestedFirstName: '',
      suggestedLastName: '',
    };
  }

  const stored = readProfileName(profile);
  const storedNameIsValid = isValidFullName(stored.firstName, stored.lastName);
  const storedPhone = storedPhoneValue(profile);
  const addressOk = !requireAddress || hasUsableAddress(profile);
  const needsName = !storedNameIsValid;
  const needsPhone = !storedPhone;
  const needsUsername = !isValidUsername(storedUsername(profile));
  const needsDob = !hasUsableDob(profile);
  const addressMissing = !addressOk;
  const onboardingRequired = needsName || needsPhone || addressMissing || needsUsername || needsDob;

  exposeSavedLocationForOnboarding(profile);

  const fromProvider = splitFullName(user.displayName);
  const suggestedFirstName = isValidNamePart(stored.firstName)
    ? stored.firstName
    : (isValidNamePart(fromProvider.firstName) ? fromProvider.firstName : '');
  const suggestedLastName = isValidNamePart(stored.lastName)
    ? stored.lastName
    : (isValidNamePart(fromProvider.lastName) ? fromProvider.lastName : '');

  return {
    skip: !onboardingRequired,
    needsName,
    needsPhone,
    needsAddress: addressMissing,
    addressAlreadySaved: addressOk,
    needsUsername,
    needsDob,
    suggestedFirstName,
    suggestedLastName,
    suggestedName: clean(`${suggestedFirstName} ${suggestedLastName}`),
  };
}

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
  const currentPhone = storedPhoneValue(currentProfile);
  const currentUsername = storedUsername(currentProfile);

  const fallback = splitFullName(submittedName);
  const firstName = clean(submittedFirstName) || fallback.firstName;
  const lastName = clean(submittedLastName) || fallback.lastName;

  if ((!currentNameIsValid || explicitNameChange) && isValidFullName(firstName, lastName)) {
    if (firstName !== current.firstName || lastName !== current.lastName) {
      patch.firstName = firstName;
      patch.lastName = lastName;
      patch.name = `${firstName} ${lastName}`;
    }
  }

  if (!currentPhone && clean(submittedPhone)) patch.phone = clean(submittedPhone);

  if (submittedAddress) {
    const savedLocation = toSavedLocation(submittedAddress);
    const currentSavedLocation = hasUsableAddress(currentProfile)
      ? toSavedLocation(storedLocation(currentProfile))
      : null;
    if (savedLocation && !locationsAreEqual(savedLocation, currentSavedLocation)) {
      patch.savedLocation = savedLocation;
      patch.address = savedLocation.address || savedLocation.name;
    }
  }

  if (!isValidUsername(currentUsername) && isValidUsername(submittedUsername)) {
    patch.username = normalizeUsername(submittedUsername);
  }

  if (!hasUsableDob(currentProfile) && isValidDob(submittedDob)) {
    patch.dob = parseDob(submittedDob);
  }

  // Firestore permite la transición protegida de onboarding únicamente desde
  // `incomplete` a `active`. Perfiles legacy/deleted conservan sus contratos
  // propios; un documento faltante se repara antes, en mantenimiento-acceso.js,
  // usando ensureUserProfile() para que nazca correctamente como incomplete.
  if (clean(currentProfile.profileStatus).toLowerCase() === 'incomplete') {
    const finalProfile = { ...currentProfile, ...patch };
    if (profileIsCompleteByFields(finalProfile, true)) patch.profileStatus = 'active';
  }

  return patch;
}
