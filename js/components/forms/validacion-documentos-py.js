/**
 * TINTIN — Documentos paraguayos (CI y RUC)
 *
 * CI (cédula de identidad): sólo dígitos, 5 a 8 (el rango real emitido).
 * RUC: 3 a 8 dígitos base + guion + dígito verificador (ej: 80012345-6).
 * Para evitar rechazos innecesarios al escribir, también se aceptan puntos,
 * espacios o el número completo sin guion y se normaliza al formato canónico.
 * No se recalcula el dígito verificador real: esa validación corresponde a
 * la DNIT; acá sólo se valida/normaliza la estructura del dato.
 */

const CI_PATTERN = /^\d{5,8}$/;
const RUC_PATTERN = /^\d{3,8}-\d$/;

export function normalizeCi(rawInput) {
  return String(rawInput || '').replace(/\D/g, '');
}

export function isValidCi(rawInput) {
  return CI_PATTERN.test(normalizeCi(rawInput));
}

export function normalizeRuc(rawInput) {
  const value = String(rawInput || '').trim().replace(/[.\s]/g, '');
  // Si escribió todos los dígitos juntos, el último es el DV. No eliminamos
  // letras u otros símbolos: deben seguir siendo inválidos en vez de quedar
  // silenciosamente convertidos en otro RUC.
  if (/^\d{4,9}$/.test(value)) return `${value.slice(0, -1)}-${value.slice(-1)}`;
  return value;
}

export function isValidRuc(rawInput) {
  return RUC_PATTERN.test(normalizeRuc(rawInput));
}

export function isValidRazonSocial(rawInput) {
  const value = String(rawInput || '').trim().replace(/\s+/g, ' ');
  return value.length >= 3 && value.length <= 180;
}
