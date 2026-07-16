// =============================================================
// TINTIN — Diagnóstico integral: compatibilidad histórica de Storage
// =============================================================
// Firebase Storage ya no forma parte de la plataforma. Este módulo conserva
// únicamente una superficie inerte para que un diagnóstico antiguo no pueda
// romperse si encuentra una referencia histórica durante una inspección. No
// importa el SDK de Firebase Storage ni realiza solicitudes de red.
import { reportBlockedWrite } from './diagnostic-shim-report.js';

export function getStorage() {
  return { app: null, __diagnosticOnly: true };
}

export function ref(_storage, path = '') {
  return {
    fullPath: String(path || ''),
    name: String(path || '').split('/').pop() || '',
    bucket: 'diagnostic-disabled'
  };
}

export async function getDownloadURL() {
  return '';
}

export async function getMetadata(reference) {
  return { fullPath: reference?.fullPath || '', contentType: null, size: 0 };
}

export async function listAll() {
  return { items: [], prefixes: [] };
}

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
