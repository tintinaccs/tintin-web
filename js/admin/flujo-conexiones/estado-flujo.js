// Estado puro del flujo de conexiones. No depende del DOM ni de Firebase.
// La evidencia de código no equivale a producción verificada.

export const EVIDENCIA = Object.freeze({
  LIVE_PRODUCTION: 'LIVE_PRODUCTION',
  LIVE_PRODUCTION_READ_ONLY: 'LIVE_PRODUCTION_READ_ONLY',
  CI_VERIFIED: 'CI_VERIFIED',
  PREVIEW_VERIFIED: 'PREVIEW_VERIFIED',
  CONTRACT_VERIFIED: 'CONTRACT_VERIFIED',
  DOCUMENTATION_ONLY: 'DOCUMENTATION_ONLY',
});

export function baselineState(state, estados) {
  return state === estados.PROD ? estados.NO_VERIFICADO : state;
}

export function classifyProbe({ ok = false, status = 0, timeout = false, implemented = true, partial = false } = {}, estados) {
  if (!implemented) return estados.DESCONECTADO;
  if (partial) return estados.PARCIAL;
  if (ok) return estados.PROD;
  if (timeout || status === 0 || status === 408 || status === 429) return estados.NO_VERIFICADO;
  if (status === 401 || status === 403) return estados.NO_VERIFICADO;
  if (status >= 500) return estados.ERROR;
  return estados.ERROR;
}

export function resolveState(record, live, estados) {
  const initial = baselineState(record?.state, estados);
  if (!live) return initial;
  if (live.status === 401 || live.status === 403 || live.authRequired) return initial;
  // Una comprobación de CI aún en curso (RUNNING/QUEUED) o sin reportar no es
  // un fallo: se conserva el estado base hasta que termine.
  if (live.pending) return initial;
  if (!live.ok) return classifyProbe(live, estados);
  // Una lectura correcta puede demostrar una parte del flujo sin demostrar
  // su mutación. Exponerla como parcial evita perder evidencia útil o pintar
  // de verde una conexión que todavía requiere prueba de escritura.
  if (live.partial === true) return classifyProbe(live, estados);
  if ((live.evidenceLevel === EVIDENCIA.LIVE_PRODUCTION || live.evidenceLevel === EVIDENCIA.CI_VERIFIED) && live.promote === true) return estados.PROD;
  if (live.evidenceLevel === EVIDENCIA.LIVE_PRODUCTION_READ_ONLY) return initial;
  return initial;
}

export function isAttentionState(state, estados) {
  return state !== estados.PROD;
}

// El pulso de una lectura HTTP exitosa no significa que el flujo esté verde.
// El marcador visible sigue el estado ya resuelto, que incorpora evidencia,
// partial y promote en lugar de mirar únicamente live.ok.
export function liveMarker(live, state, estados) {
  if (!live) return null;
  if (live.pending) return { symbol: '◌', label: 'en curso', kind: 'pending' };
  if (state === estados.PARCIAL) return { symbol: '◐', label: 'parcial', kind: 'partial' };
  if (state === estados.PROD) return { symbol: '●', label: 'live', kind: 'live' };
  if (live.ok) return { symbol: '◌', label: 'lectura', kind: 'unconfirmed' };
  return { symbol: '✕', label: 'live', kind: 'error' };
}

// Los filtros de estado/búsqueda se aplican a la conexión misma. Limitar esas
// filas a los nodos visibles ocultaba conexiones parciales entre nodos verdes.
export function shouldShowFlowEdge(edge, {
  selectedNodeId = null,
  visibleNodeIds = new Set(),
  hasExplicitFilter = false,
  matchesEdge = () => true,
} = {}) {
  if (selectedNodeId) return edge.from === selectedNodeId || edge.to === selectedNodeId;
  if (hasExplicitFilter) return matchesEdge(edge);
  return matchesEdge(edge) && (visibleNodeIds.has(edge.from) || visibleNodeIds.has(edge.to));
}

