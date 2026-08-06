// =============================================================
// TINTIN — Diagnóstico integral: reporte compartido de escrituras bloqueadas
// =============================================================
// Usado únicamente dentro del iframe aislado del Diagnóstico de Super Admin.
// Nunca se carga en una página real servida a personas visitantes.
export function reportBlockedWrite(name, detail) {
  try {
    window.parent?.postMessage({
      source: 'tt-diagnostic-shim',
      blockedCall: name,
      detail: detail || null,
      at: Date.now()
    }, window.location.origin);
  } catch (_) {
    // El postMessage nunca debe poder romper la página inspeccionada.
  }
  try {
    console.warn(`[Diagnóstico] Escritura bloqueada de forma segura: ${name}()`);
  } catch (_) {}
}
