/**
 * TINTIN — Documentos paraguayos (CI y RUC)
 *
 * CI (cédula de identidad): sólo dígitos, 5 a 8 (el rango real emitido).
 * RUC: dígitos + guion + dígito verificador (ej: 80012345-6). El RUC de una
 * persona física suele coincidir con su CI seguida del dígito verificador;
 * acá sólo se valida el formato, no se recalcula el dígito verificador real
 * (ese cálculo es responsabilidad de la DNIT, no de este checkout).
 */

const CI_PATTERN = /^\d{5,8}$/;
const RUC_PATTERN = /^\d{5,8}-\d$/;

export function normalizeCi(rawInput) {
  return String(rawInput || '').replace(/\D/g, '');
}

export function isValidCi(rawInput) {
  return CI_PATTERN.test(normalizeCi(rawInput));
}

export function normalizeRuc(rawInput) {
  return String(rawInput || '').trim().replace(/\s+/g, '');
}

export function isValidRuc(rawInput) {
  return RUC_PATTERN.test(normalizeRuc(rawInput));
}

export function isValidRazonSocial(rawInput) {
  const value = String(rawInput || '').trim().replace(/\s+/g, ' ');
  return value.length >= 3 && value.length <= 180;
}
