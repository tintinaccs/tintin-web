// Espejo incremental del repositorio en Google Drive («Tintin — Espejo de GitHub»).
// Sube solo los archivos cuyo contenido (SHA de blob de Git) cambió desde la última ejecución.
// Nunca borra en Drive: un archivo eliminado en GitHub se conserva como respaldo.
// Sin dependencias. Alcance OAuth mínimo: drive.file. Variables: DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_REFRESH_TOKEN.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

export const ROOT_NAME = 'Tintin — Espejo de GitHub';
export const STATE_NAME = '.espejo-estado.json';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const esc = value => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

export function createClient(token, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))) {
  async function call(url, init = {}, what = url) {
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try { response = await fetchImpl(url, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } }); }
      catch (error) { if (attempt >= 4) throw new Error(`${what}: ${error.message}`); await sleep(500 * 2 ** attempt); continue; }
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500 || response.status === 403) && attempt < 4) { await sleep(500 * 2 ** attempt); continue; }
      throw new Error(`${what} falló (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }
  }
  const json = async (url, init, what) => (await call(url, init, what)).json();
  const q = params => new URLSearchParams(params).toString();

  return {
    async readJson(fileId) { return (await call(`${API}/files/${fileId}?alt=media`, {}, 'Leer estado del espejo')).json(); },
    async listChildren(parentId) {
      const out = new Map();
      let pageToken;
      do {
        const data = await json(`${API}/files?${q({ q: `'${parentId}' in parents and trashed = false`, fields: 'nextPageToken,files(id,name,mimeType)', pageSize: '1000', ...(pageToken ? { pageToken } : {}) })}`, {}, 'Listar carpeta');
        for (const file of data.files || []) out.set(file.name, file);
        pageToken = data.nextPageToken;
      } while (pageToken);
      return out;
    },
    async ensureFolder(name, parentId) {
      const query = `name = '${esc(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
      const found = await json(`${API}/files?${q({ q: query, fields: 'files(id)' })}`, {}, 'Buscar carpeta');
      if (found.files?.length) return found.files[0].id;
      const created = await json(`${API}/files?fields=id`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
      }, 'Crear carpeta');
      return created.id;
    },
    // Crea (existingId ausente) o reemplaza el contenido; verifica tamaño y MD5 contra el original.
    async putFile({ name, parentId, existingId, body }) {
      const url = existingId
        ? `${UPLOAD}/files/${existingId}?uploadType=resumable&fields=id,size,md5Checksum`
        : `${UPLOAD}/files?uploadType=resumable&fields=id,size,md5Checksum`;
      const start = await call(url, {
        method: existingId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'application/octet-stream' },
        body: JSON.stringify(existingId ? {} : { name, parents: [parentId] }),
      }, `Iniciar subida de ${name}`);
      const location = start.headers.get('location');
      if (!location) throw new Error(`Drive no devolvió URL de subida para ${name}`);
      const done = await (await call(location, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body }, `Subir ${name}`)).json();
      if (Number(done.size) !== body.length || done.md5Checksum !== createHash('md5').update(body).digest('hex')) {
        throw new Error(`Verificación de ${name} falló: tamaño o MD5 distinto al local`);
      }
      return done.id;
    },
  };
}

export async function getAccessToken(env, fetchImpl = fetch) {
  for (const key of ['DRIVE_CLIENT_ID', 'DRIVE_CLIENT_SECRET', 'DRIVE_REFRESH_TOKEN']) if (!env[key]) throw new Error(`Falta ${key}`);
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.DRIVE_CLIENT_ID, client_secret: env.DRIVE_CLIENT_SECRET, refresh_token: env.DRIVE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
  });
  if (!response.ok) throw new Error(`Obtener token de Drive falló (${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Drive no devolvió access_token');
  return data.access_token;
}

export function readTree(cwd = process.cwd()) {
  const raw = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], { cwd, maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
  const files = {};
  for (const entry of raw.split('\0').filter(Boolean)) {
    const [meta, path] = entry.split('\t');
    const [mode, type, sha] = meta.split(' ');
    if (type === 'blob' && mode !== '160000') files[path] = sha;
  }
  return files;
}

export function changedPaths(tree, previous) {
  return Object.keys(tree).filter(path => previous[path] !== tree[path]).sort();
}

async function mapLimit(items, limit, fn) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await fn(items[index]); }
  }));
  return results;
}

export async function syncMirror({ client, tree, readBody, log = console.log }) {
  const rootId = await client.ensureFolder(ROOT_NAME);
  const state = await client.listChildren(rootId);
  let previous = {};
  const stateFile = state.get(STATE_NAME);
  if (stateFile) {
    previous = (await client.readJson(stateFile.id)) || {};
  }
  const todo = changedPaths(tree, previous);
  if (!todo.length) { log('Espejo al día: no hay archivos distintos.'); return { uploaded: 0 }; }

  // Carpetas primero y en orden (padres antes que hijos).
  const folderIds = new Map([['', rootId]]);
  const dirs = [...new Set(todo.map(p => posix.dirname(p)).filter(d => d !== '.'))];
  const needed = new Set();
  for (const dir of dirs) { const parts = dir.split('/'); for (let i = 1; i <= parts.length; i += 1) needed.add(parts.slice(0, i).join('/')); }
  for (const dir of [...needed].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))) {
    folderIds.set(dir, await client.ensureFolder(posix.basename(dir), folderIds.get(posix.dirname(dir) === '.' ? '' : posix.dirname(dir))));
  }
  const children = new Map();
  for (const dir of new Set(todo.map(p => (posix.dirname(p) === '.' ? '' : posix.dirname(p))))) children.set(dir, await client.listChildren(folderIds.get(dir)));

  const done = { ...previous };
  let stateId = stateFile?.id;
  let saving = Promise.resolve();
  const save = () => { saving = saving.then(async () => { stateId = await client.putFile({ name: STATE_NAME, parentId: rootId, existingId: stateId, body: Buffer.from(JSON.stringify(done)) }); }); return saving; };
  let completed = 0;
  try {
    await mapLimit(todo, 5, async path => {
      const dir = posix.dirname(path) === '.' ? '' : posix.dirname(path);
      const name = posix.basename(path);
      const existing = children.get(dir).get(name);
      await client.putFile({ name, parentId: folderIds.get(dir), existingId: existing && existing.mimeType !== FOLDER_MIME ? existing.id : undefined, body: readBody(path) });
      done[path] = tree[path];
      if (++completed % 100 === 0) await save(); // progreso persistente: una ejecución cortada retoma donde quedó
    });
  } catch (error) {
    if (completed) await save().catch(() => {}); // lo copiado queda registrado aunque otro archivo falle
    throw error;
  }
  await save();
  log(`Espejo actualizado: ${todo.length} archivo(s) subidos y verificados.`);
  return { uploaded: todo.length };
}

async function main() {
  const client = createClient(await getAccessToken(process.env));
  await syncMirror({ client, tree: readTree(), readBody: path => readFileSync(path) });
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error.message); process.exit(1); });
