// Diagnóstico seguro y acotado de restauración de sesión.
// Nunca guarda UID, email, token, claims ni payloads de Firebase.
const MAX_EVENTS = 80;

function safeRoute() {
  if (typeof window === 'undefined') return '';
  return String(window.location.pathname || '/').slice(0, 220);
}

export function recordAuthDiagnostic(code, detail = {}) {
  if (typeof window === 'undefined' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(String(code || ''))) return null;
  // Mantener códigos técnicos, nunca objetos de error ni mensajes libres.
  const safeDetail = { ...(detail || {}) };
  if (typeof safeDetail.code === 'string') safeDetail.errorCode = safeDetail.code;
  const event = Object.freeze({
    code: String(code),
    at: new Date().toISOString(),
    epochMs: Date.now(),
    route: safeRoute(),
    ...Object.fromEntries(Object.entries(safeDetail).filter(([key, value]) => (
      !/uid|email|token|claim|credential|password|payload|userId|^(?:route|at|epochMs|code)$/i.test(key) &&
      (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && /^[a-zA-Z0-9_./:-]{1,100}$/.test(value)))
    )))
  });
  const previous = Array.isArray(window.__TINTIN_AUTH_DIAGNOSTICS__)
    ? window.__TINTIN_AUTH_DIAGNOSTICS__
    : [];
  window.__TINTIN_AUTH_DIAGNOSTICS__ = [...previous, event].slice(-MAX_EVENTS);
  return event;
}

export function getAuthDiagnostics() {
  if (typeof window === 'undefined' || !Array.isArray(window.__TINTIN_AUTH_DIAGNOSTICS__)) return [];
  return window.__TINTIN_AUTH_DIAGNOSTICS__.slice();
}
