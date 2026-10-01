// =============================================================
// TINTIN ACCESORIOS — Sellos del flujo de conexiones (lógica pura)
// =============================================================
// Un "sello" fija en verde un nodo o conexión que el Super Admin vio verde en
// una revalidación en vivo y confirmó con "Sellar verdes". Guarda la huella
// (sha256 de diagnostic-manifest.json) de cada archivo de su evidencia.
//
// Reglas:
// - Sellado y sin cambios en sus archivos → verde, aunque no se revalide.
// - Sellado y con algún archivo cambiado → NO verificado (amarillo) aunque la
//   prueba en vivo responda: alguien tocó el código y hay que volver a
//   confirmarlo a propósito (nunca se re-sella solo).
// - Una prueba en vivo que FALLA siempre se muestra, con o sin sello.
// No depende del DOM ni de Firebase: se prueba con `node --test`.

/** Archivos de evidencia de un nodo, o de una conexión más sus dos extremos. */
export function recordFiles(record, nodesById = {}) {
  const collect = item => (item?.evidence || []).map(ev => ev?.file).filter(Boolean);
  const files = [...collect(record)];
  if (record?.from || record?.to) {
    files.push(...collect(nodesById[record.from]), ...collect(nodesById[record.to]));
  }
  // Una carpeta ("tests/") no tiene huella propia.
  return [...new Set(files)].filter(file => !file.endsWith('/')).sort();
}

/** Huella actual: { archivo: sha256 | null } según el manifiesto publicado. */
export function fingerprint(files, shaByPath = {}) {
  return Object.fromEntries(files.map(file => [file, shaByPath[file] || null]));
}

/**
 * Compara un sello con la huella actual.
 * @returns {null | { intact: boolean, changed: string[], sealedAt: string, sealedBy: string }}
 */
export function checkSeal(seal, current = {}) {
  if (!seal || typeof seal !== 'object' || !Array.isArray(seal.files)) return null;
  // En Firestore la huella se guarda como lista: los nombres de archivo tienen
  // puntos y no sirven como claves de un mapa.
  const sealed = Object.fromEntries(seal.files.filter(item => item && item.path).map(item => [item.path, item.sha || null]));
  const paths = new Set([...Object.keys(sealed), ...Object.keys(current)]);
  const changed = [...paths].filter(path => (sealed[path] || null) !== (current[path] || null)).sort();
  return { intact: changed.length === 0, changed, sealedAt: String(seal.sealedAt || ''), sealedBy: String(seal.sealedBy || '') };
}

/** Estado final mostrado, aplicando el sello sobre el estado ya resuelto. */
export function applySeal(state, sealCheck, live, estados) {
  if (!sealCheck) return state;
  const liveFailed = Boolean(live && live.ok === false && !live.pending && !live.authRequired &&
    live.status !== 401 && live.status !== 403);
  if (liveFailed) return state;
  return sealCheck.intact ? estados.PROD : estados.NO_VERIFICADO;
}

/** Sello nuevo para un registro que ahora está verde. */
export function buildSeal(files, shaByPath, { sealedAt, sealedBy = '' } = {}) {
  const current = fingerprint(files, shaByPath);
  return {
    files: Object.entries(current).map(([path, sha]) => ({ path, sha })),
    sealedAt: String(sealedAt || ''),
    sealedBy: String(sealedBy || ''),
  };
}

/** Mapa { archivo: sha256 } a partir de diagnostic-manifest.json. */
export function shaMapFromManifest(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  return Object.fromEntries(files.filter(f => f && f.path && f.sha256).map(f => [f.path, f.sha256]));
}
