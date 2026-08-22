/**
 * TINTIN — Fecha de nacimiento
 *
 * Valida que la edad esté entre 16 y 120 años al momento de completar el
 * perfil. Solo se guarda la fecha de nacimiento en Firestore (`dob`); la edad
 * NUNCA se persiste calculada, porque quedaría desactualizada con el tiempo —
 * se vuelve a calcular a partir de `dob` cada vez que hace falta.
 */

const MIN_AGE = 16;
const MAX_AGE = 120;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Convierte el valor de un <input type="date"> (YYYY-MM-DD) a Date en UTC, o null si es inválido. */
export function parseDob(rawInput) {
  const value = String(rawInput || '').trim();
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Date normaliza silenciosamente fechas imposibles (31 de febrero → 3 de
  // marzo); comparar los componentes de vuelta rechaza esos casos.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Edad en años cumplidos a la fecha indicada (por defecto, ahora). */
export function ageFromDob(date, atDate = new Date()) {
  let age = atDate.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = atDate.getUTCMonth() - date.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getUTCDate() < date.getUTCDate())) age -= 1;
  return age;
}

/** ¿Es una fecha de nacimiento válida y da una edad entre 16 y 120 años? */
export function isValidDob(rawInput, atDate = new Date()) {
  const date = parseDob(rawInput);
  if (!date || date.getTime() > atDate.getTime()) return false;
  const age = ageFromDob(date, atDate);
  return age >= MIN_AGE && age <= MAX_AGE;
}
