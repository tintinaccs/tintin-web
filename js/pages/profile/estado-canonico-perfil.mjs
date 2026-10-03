// Perfil de cuenta: proyección pura de Firestore y cambios explícitos.
// No crea usuarios, no concede roles y no utiliza datos locales como autoridad.
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const firstPresent = (...values) => values.find(value => clean(value) !== '') ?? '';

function providerPhoto(user = {}) {
  const providers = Array.isArray(user?.providerData) ? user.providerData : [];
  const google = providers.find(provider => clean(provider?.providerId).toLowerCase() === 'google.com');
  return clean(google?.photoURL);
}

/**
 * La foto del proveedor es la identidad visual de una sesión Google. Las
 * versiones históricas del perfil copiaban `photoURL` a Firestore incluso
 * cuando sólo era un valor viejo y terminaban tapando esa identidad. Una foto
 * cargada conscientemente desde "Cambiar foto" vive ahora en `avatarURL` y
 * sí tiene prioridad explícita.
 */
export function resolveAccountAvatar(profile = {}, user = {}) {
  const explicitAvatar = clean(firstPresent(
    profile.avatarURL,
    profile.avatarUrl,
    profile.customAvatarURL,
    profile.customAvatarUrl,
  ));
  if (explicitAvatar) return explicitAvatar;

  const signedInProviderPhoto = providerPhoto(user);
  if (signedInProviderPhoto) return signedInProviderPhoto;

  return clean(firstPresent(user.photoURL, profile.photoURL));
}

export function readAccountIdentity(profile = {}, user = {}) {
  const firstName = clean(firstPresent(profile.firstName, profile.first_name, profile.nombre));
  const lastName = clean(firstPresent(profile.lastName, profile.last_name, profile.apellido));
  const fullName = clean(firstPresent(profile.name, profile.fullName, profile.nombreCompleto));
  const name = clean(`${firstName} ${lastName}`) || fullName || clean(user.displayName);
  return {
    name,
    firstName: firstName || (fullName ? fullName.split(' ')[0] : ''),
    lastName: lastName || (fullName ? fullName.split(' ').slice(1).join(' ') : ''),
    email: clean(user.email),
    username: clean(firstPresent(profile.username, profile.userName, profile.nombreUsuario, profile.nombre_usuario)),
    phone: clean(firstPresent(profile.phone, profile.phoneNumber, profile.whatsapp, profile.whatsappNumber, profile.telefono, profile.celular)),
    address: clean(firstPresent(profile.address, profile.direccion)),
    dob: profile.dob ?? profile.birthDate ?? profile.dateOfBirth ?? profile.fechaNacimiento ?? profile.fecha_nacimiento ?? null,
    photoURL: resolveAccountAvatar(profile, user),
    savedLocation: profile.savedLocation ?? null,
  };
}

export function buildAccountNamePatch(current = {}, submitted = {}) {
  const firstName = clean(submitted.firstName);
  const lastName = clean(submitted.lastName);
  if (!firstName || !lastName) throw new Error('profile/name-required');
  const name = `${firstName} ${lastName}`;
  if (firstName === clean(current.firstName) && lastName === clean(current.lastName) && name === clean(current.name)) return {};
  return { firstName, lastName, name };
}

export function accountReadState(error, online = true) {
  if (!error) return 'ready';
  if (online === false) return 'offline';
  if (error.code === 'permission-denied') return 'permission-denied';
  if (error.code === 'not-found') return 'not-found';
  return 'unavailable';
}

export function reconcileAccountOrders(queries) {
  if (!Array.isArray(queries) || queries.some(query => !Array.isArray(query))) throw new Error('profile/orders-incomplete');
  const orders = new Map();
  for (const query of queries) {
    for (const order of query) {
      if (order?.id) orders.set(order.id, order);
    }
  }
  return [...orders.values()];
}
