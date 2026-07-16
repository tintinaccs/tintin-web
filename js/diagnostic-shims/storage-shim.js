// =============================================================
// TINTIN — Diagnóstico integral: shim de solo lectura para Firebase Storage
// =============================================================
// Ninguna página de la plataforma sube ni borra archivos en la carga inicial
// hoy, pero este shim existe igual como resguardo: si en el futuro algún
// módulo llamara una de estas funciones durante la carga, el diagnóstico no
// debe poder subir ni borrar archivos reales. Lecturas (getDownloadURL, ref,
// listAll, getMetadata) pasan directo al SDK real.
import { reportBlockedWrite } from './diagnostic-shim-report.js';

export * from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

export async function uploadBytes(reference) {
  reportBlockedWrite('uploadBytes', reference?.fullPath || null);
  return { metadata: { fullPath: reference?.fullPath || '__diagnostic_blocked__' } };
}

export async function uploadString(reference) {
  reportBlockedWrite('uploadString', reference?.fullPath || null);
  return { metadata: { fullPath: reference?.fullPath || '__diagnostic_blocked__' } };
}

export function uploadBytesResumable(reference) {
  reportBlockedWrite('uploadBytesResumable', reference?.fullPath || null);
  const listeners = {};
  return {
    on: (_event, _progress, _error, complete) => {
      if (typeof complete === 'function') complete();
    },
    then: resolve => resolve({ metadata: { fullPath: reference?.fullPath || '__diagnostic_blocked__' } }),
    snapshot: { ref: reference }
  };
}

export async function deleteObject(reference) {
  reportBlockedWrite('deleteObject', reference?.fullPath || null);
  return undefined;
}
