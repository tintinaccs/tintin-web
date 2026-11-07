// Sube los archivos de respaldo a Google Drive (carpeta «Tintin — Respaldos (automático)»).
// Sin dependencias. Alcance OAuth mínimo: drive.file (solo ve y toca lo que este mismo cliente creó).
// Variables: DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_REFRESH_TOKEN. Uso: node subir-respaldo-drive.mjs <archivo>...
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

export const FOLDER_NAME = 'Tintin — Respaldos (automático)';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const RETENTION_DAYS = 60;
export const MIN_KEEP = 9; // nunca se eliminan los 9 archivos más recientes (3 respaldos)

async function jsonOrThrow(response, what) {
  if (!response.ok) throw new Error(`${what} falló (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

export async function getAccessToken(env, fetchImpl = fetch) {
  for (const key of ['DRIVE_CLIENT_ID', 'DRIVE_CLIENT_SECRET', 'DRIVE_REFRESH_TOKEN']) {
    if (!env[key]) throw new Error(`Falta ${key}`);
  }
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DRIVE_CLIENT_ID,
      client_secret: env.DRIVE_CLIENT_SECRET,
      refresh_token: env.DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await jsonOrThrow(response, 'Obtener token de Drive');
  if (!data.access_token) throw new Error('Drive no devolvió access_token');
  return data.access_token;
}

export async function ensureFolder(token, fetchImpl = fetch) {
  const auth = { authorization: `Bearer ${token}` };
  const q = `name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const found = await jsonOrThrow(
    await fetchImpl(`${API}/files?${new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive' })}`, { headers: auth }),
    'Buscar carpeta',
  );
  if (found.files?.length) return found.files[0].id;
  const created = await jsonOrThrow(
    await fetchImpl(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
    }),
    'Crear carpeta',
  );
  return created.id;
}

export async function uploadFile(token, folderId, path, fetchImpl = fetch) {
  const body = readFileSync(path);
  const name = basename(path);
  const auth = { authorization: `Bearer ${token}` };
  const start = await fetchImpl(`${UPLOAD}/files?uploadType=resumable&fields=id,size,md5Checksum`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'application/octet-stream' },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  if (!start.ok) throw new Error(`Iniciar subida de ${name} falló (${start.status})`);
  const location = start.headers.get('location');
  if (!location) throw new Error(`Drive no devolvió URL de subida para ${name}`);
  const done = await jsonOrThrow(
    await fetchImpl(location, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body }),
    `Subir ${name}`,
  );
  const md5 = createHash('md5').update(body).digest('hex');
  if (Number(done.size) !== statSync(path).size || done.md5Checksum !== md5) {
    throw new Error(`Verificación de ${name} falló: tamaño o MD5 distinto al local`);
  }
  return { id: done.id, name, size: Number(done.size) };
}

// Mueve a la papelera (recuperable 30 días) solo archivos propios de esta carpeta más viejos que la retención.
export async function pruneOld(token, folderId, now = Date.now(), fetchImpl = fetch) {
  const auth = { authorization: `Bearer ${token}` };
  const list = await jsonOrThrow(
    await fetchImpl(`${API}/files?${new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: '1000',
    })}`, { headers: auth }),
    'Listar respaldos',
  );
  const cutoff = now - RETENTION_DAYS * 86_400_000;
  const stale = (list.files || []).slice(MIN_KEEP).filter(file => Date.parse(file.createdTime) < cutoff);
  for (const file of stale) {
    await jsonOrThrow(
      await fetchImpl(`${API}/files/${file.id}?fields=id`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      }),
      'Mover respaldo antiguo a la papelera',
    );
  }
  return stale.length;
}

async function main(paths) {
  if (!paths.length) throw new Error('Indica al menos un archivo a subir');
  const token = await getAccessToken(process.env);
  const folderId = await ensureFolder(token);
  for (const path of paths) {
    const result = await uploadFile(token, folderId, path);
    console.log(`Subido y verificado: ${result.name} (${result.size} bytes)`);
  }
  console.log(`Respaldos antiguos movidos a la papelera: ${await pruneOld(token, folderId)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
