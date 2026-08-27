import { getGoogleAccessToken, parseServiceAccount } from './firebase-admin-ligero.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
export const MAX_ADMIN_BATCH_WRITES = 120;

function documentPrefix(serviceAccount) {
  return `projects/${serviceAccount.project_id}/databases/(default)/documents/`;
}

function databaseUrl(serviceAccount) {
  return `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)`;
}

function validPath(path) {
  return /^(?:[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)*$/.test(path);
}

function encodeWrite(write, prefix) {
  const path = String(write?.path || '');
  if (!validPath(path)) throw new Error('Ruta de documento inválida para commit administrativo');
  const currentDocument = write?.currentDocument && typeof write.currentDocument === 'object'
    ? { currentDocument: write.currentDocument }
    : {};
  if (write?.delete) return { delete: prefix + path, ...currentDocument };
  const updateMask = Array.isArray(write?.mergeFields) && write.mergeFields.length
    ? { updateMask: { fieldPaths: write.mergeFields.map(field => String(field)) } }
    : {};
  return {
    update: { name: prefix + path, fields: write?.fields || {} },
    ...updateMask,
    ...currentDocument,
  };
}

/**
 * Commit atómico para mutaciones administrativas que pueden tocar muchos
 * documentos (p. ej. un pedido histórico con varias líneas). El límite sigue
 * siendo deliberadamente mucho menor al máximo de Firestore para evitar que
 * una solicitud administrativa accidental se convierta en una escritura masiva.
 */
export async function firestoreAdminBatchCommit(env, writes, { fetchImpl = fetch } = {}) {
  const list = Array.isArray(writes) ? writes : [];
  if (!list.length || list.length > MAX_ADMIN_BATCH_WRITES) {
    throw new Error('Cantidad de escrituras administrativas inválida');
  }
  const sa = parseServiceAccount(env);
  const accessToken = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const prefix = documentPrefix(sa);
  const response = await fetchImpl(`${databaseUrl(sa)}/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ writes: list.map(write => encodeWrite(write, prefix)) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const conflict = data?.error?.status === 'FAILED_PRECONDITION' || data?.error?.status === 'ABORTED' || response.status === 409;
    throw Object.assign(
      new Error(conflict ? 'Conflicto de versión en Firestore.' : `Firestore ADMIN COMMIT falló (${response.status}).`),
      { status: conflict ? 409 : 502, code: conflict ? 'version_conflict' : 'firestore_admin_commit_failed' },
    );
  }
  return response.json();
}
