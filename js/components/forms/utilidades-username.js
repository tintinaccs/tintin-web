/**
 * TINTIN — Username de cuenta
 * Normaliza y valida el nombre de usuario que se usa como identificador
 * alternativo de login (junto con el email). La unicidad es case-insensitive:
 * "Ana98" y "ana98" son el mismo username.
 */

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// Palabras que no pueden quedar como username propio: confundirían con
// cuentas oficiales o rutas del sitio.
const RESERVED_USERNAMES = [
  'admin', 'administrador', 'superadmin', 'root', 'soporte', 'support',
  'tintin', 'tintinaccesorios', 'sistema', 'system', 'api', 'null', 'undefined',
  'cuenta', 'cuentas', 'usuario', 'usuarios', 'login', 'logout', 'guest',
];

/** Normaliza a la forma canónica usada como clave de reserva y de login. */
export function normalizeUsername(rawInput) {
  return String(rawInput || '').trim().toLowerCase();
}

export function isValidUsernameFormat(rawInput) {
  const value = normalizeUsername(rawInput);
  return USERNAME_PATTERN.test(value) && !/^_|_$/.test(value);
}

export function isReservedUsername(rawInput) {
  return RESERVED_USERNAMES.includes(normalizeUsername(rawInput));
}

export function isValidUsername(rawInput) {
  return isValidUsernameFormat(rawInput) && !isReservedUsername(rawInput);
}

/** Clave del documento de reserva: el username ya normalizado. */
export function usernameKey(rawInput) {
  const value = normalizeUsername(rawInput);
  return isValidUsername(value) ? value : '';
}
