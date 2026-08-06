/* =============================================================
   TINTIN — endurecimiento posterior a las fases

   Los datos de Firestore y localStorage se convierten siempre en texto plano
   antes de llegar a renderizadores históricos que todavía usan plantillas.
   ============================================================= */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function cleanText(value, maxLength = 4000) {
  return String(value == null ? '' : value)
    .replace(CONTROL_CHARS, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function cleanMultilineText(value, maxLength = 4000) {
  return String(value == null ? '' : value)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(CONTROL_CHARS, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeVariantData(value, depth = 0) {
  if (depth > 3 || value == null) return null;
  if (typeof value === 'string') return cleanText(value, 180);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => sanitizeVariantData(item, depth + 1)).filter(item => item != null);
  }
  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).slice(0, 50).forEach(([key, item]) => {
      const safeKey = cleanText(key, 80);
      const safeValue = sanitizeVariantData(item, depth + 1);
      if (safeKey && safeValue != null) result[safeKey] = safeValue;
    });
    return result;
  }
  return null;
}
