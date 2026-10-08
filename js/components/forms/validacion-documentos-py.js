/**
 * TINTIN — Documentos paraguayos (CI y RUC)
 *
 * CI (cédula de identidad): sólo dígitos, 5 a 8 (el rango real emitido).
 * RUC: dígitos + guion + dígito verificador (ej: 80012345-6). El RUC de una
 * persona física suele coincidir con su CI seguida del dígito verificador;
 * SIFEN v150 D206/D207 admite cuerpo de 3–8 dígitos y DV numérico.
 * RG 133/23: CI para persona física; series 50.000.000 y 80.000.000.
 * No se exige prefijo 800: no describe todas las entidades admitidas.
 * El formato no acredita inscripción ni estado tributario en Marangatu.
 */

const CI_PATTERN = /^\d{5,8}$/;
const RUC_PATTERN = /^\d{3,8}-\d$/;

export function isValidTaxpayerType(value) {
  return value === 'fisica' || value === 'juridica';
}

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
