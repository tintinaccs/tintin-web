// Diagnóstico seguro y acotado de restauración de sesión.
// Nunca guarda UID, email, token, claims ni payloads de Firebase.
const MAX_EVENTS = 80;

function safeRoute() {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, 220);
}

export function recordAuthDiagnostic(code, detail = {}) {
  if (typeof window === 'undefined' || !code) return null;
  const event = Object.freeze({
    code: String(code),
    at: new Date().toISOString(),
    epochMs: Date.now(),
    route: safeRoute(),
    ...Object.fromEntries(Object.entries(detail).filter(([key]) => (
      !/uid|email|token|claim|credential|password|payload|userId/i.test(key)
    )))
  });
  const previous = Array.isArray(window.__TINTIN_AUTH_DIAGNOSTICS__)
    ? window.__TINTIN_AUTH_DIAGNOSTICS__
    : [];
  window.__TINTIN_AUTH_DIAGNOSTICS__ = [...previous, event].slice(-MAX_EVENTS);
  try { console.info(`[TintinAuth] ${event.code}`, event); } catch {}
  return event;
}

export function getAuthDiagnostics() {
  if (typeof window === 'undefined' || !Array.isArray(window.__TINTIN_AUTH_DIAGNOSTICS__)) return [];
  return window.__TINTIN_AUTH_DIAGNOSTICS__.slice();
}
