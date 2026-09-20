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
  if (!live.ok) return classifyProbe(live, estados);
  if ((live.evidenceLevel === EVIDENCIA.LIVE_PRODUCTION || live.evidenceLevel === EVIDENCIA.CI_VERIFIED) && live.promote === true) return estados.PROD;
  if (live.evidenceLevel === EVIDENCIA.LIVE_PRODUCTION_READ_ONLY) return initial;
  return initial;
}

export function isAttentionState(state, estados) {
  return state !== estados.PROD;
}

