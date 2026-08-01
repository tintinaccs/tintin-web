function clean(value) {
  return String(value || '').trim();
}

export function isSuperAdminProfile({ email = '', role = '' } = {}, superAdminEmail = '') {
  return clean(role).toLowerCase() === 'superadmin' ||
    clean(email).toLowerCase() === clean(superAdminEmail).toLowerCase();
}

export function getProfileCompletionPlan({ profile = {}, user = {}, role = '', superAdminEmail = '' } = {}) {
  if (isSuperAdminProfile({ email: user.email, role }, superAdminEmail)) {
    return { skip: true, needsName: false, needsPhone: false, suggestedName: '' };
  }

  const storedName = clean(profile.name);
  const storedPhone = clean(profile.phone);
  const suggestedName = storedName || clean(user.displayName);

  return {
    skip: Boolean(storedName && storedPhone),
    needsName: !storedName,
    needsPhone: !storedPhone,
    suggestedName,
  };
}

// Se ejecuta con el perfil vuelto a leer dentro de una transacción. Así un
// dato que otro proceso completó mientras el formulario estaba abierto nunca
// se pisa por accidente.
export function buildMissingProfilePatch({
  currentProfile = {},
  submittedName = '',
  submittedPhone = '',
  explicitNameChange = false,
} = {}) {
  const patch = {};
  const currentName = clean(currentProfile.name);
  const currentPhone = clean(currentProfile.phone);
  const name = clean(submittedName);
  const phone = clean(submittedPhone);

  if ((!currentName || explicitNameChange) && name && name !== currentName) patch.name = name;
  if (!currentPhone && phone) patch.phone = phone;
  return patch;
}
