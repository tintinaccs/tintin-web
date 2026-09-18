/*
 * Tintin Admin — Shopify catalog preparation.
 *
 * This is the single import surface for admin.html. It deliberately stops at
 * PREVIEW/READY: this phase prepares and validates a resumable job but does
 * not migrate the production catalog. Product writes, media downloads and
 * cutover require a separately authorized phase.
 */

import { db } from '../core/firebase/firebase.js?v=tintin-20260908-admin-cache-reset-1';
import { subscribeAuthState } from '../core/auth/coordinador-sesion.js?v=tintin-20260918-global-session-restore-2';
import { collection } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { SUPER_ADMIN } from '../core/auth/roles.js?v=tintin-20260916-final-polish-2';
import { getDocsPaginated } from '../core/firebase/paginacion-firestore.js?v=tintin-20260716-cloudinary-fix-1';
import {
  detectCsvDelimiter,
  parseDelimitedRowsStream,
  parseLocalizedNumber,
  parseOptionalStock,
  validateOperationalBackupEnvelope,
} from '../core/store/normalizacion-importacion.mjs?v=tintin-20260917-admin-import-stream-1';
import {
  buildImportFingerprint,
  chunkImportRecords,
  cleanImportText,
  groupShopifyRows,
  normalizeImportKey,
  normalizeImportTags,
  safeImportUrl,
  sanitizeShopifyBodyHtml,
  summarizeImportRecords,
} from '../core/store/shopify-import-core.mjs?v=tintin-20260917-shopify-import-core-2';
import { authenticatedFetch, apiFailureMessage } from '../core/auth/cliente-api-autenticado.js?v=tintin-20260918-global-session-restore-2';

if (!window.TintinAdminShopifyImportBooted) {
  window.TintinAdminShopifyImportBooted = true;

  const PROJECT_ID = 'tintin-accesorios';
  const MAX_FILE_BYTES = 250 * 1024 * 1024;
  const PREVIEW_ROWS = 250;
  const JOB_ENDPOINT = '/api/admin-import-job';
  const LOCAL_DB = 'tintin-admin-import-jobs-v1';
  const LOCAL_STORE = 'jobs';
  const state = {
    user: null,
    collections: [],
    records: [],
    invalidRows: [],
    fileName: '',
    fileBytes: 0,
    fileChecksum: '',
    source: '',
    jobId: '',
    job: null,
    busy: false,
    ui: null,
  };

  const text = value => String(value == null ? '' : value);
  const lower = value => text(value).trim().toLocaleLowerCase('es');

  function node(tag, className = '', value = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== '') element.textContent = value;
    return element;
  }

  function toast(message, error = false) {
    const element = document.getElementById('adm-toast');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('phase10-error', error);
    element.classList.add('show');
    clearTimeout(element._shopifyImportTimer);
    element._shopifyImportTimer = setTimeout(() => element.classList.remove('show'), 5000);
  }

  function isSuperAdmin() {
    return Boolean(state.user && lower(state.user.email) === lower(SUPER_ADMIN));
  }

  function toPlain(value) {
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(toPlain);
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlain(item)]));
    return text(value);
  }

  async function readCollection(name, maxDocs = 20000) {
    const snapshot = await getDocsPaginated(collection(db, name), { pageSize: 500, maxDocs });
    if (snapshot.truncated) throw new Error(`La colección ${name} supera el límite seguro de referencia (${maxDocs}).`);
    return snapshot.docs.map(item => ({ id: item.id, ...toPlain(item.data()) }));
  }

  function downloadJson(fileName, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportOperationalBackup() {
    if (!isSuperAdmin() || state.busy) return;
    state.busy = true;
    state.ui.backup.disabled = true;
    state.ui.backup.textContent = 'Preparando copia…';
    try {
      const [products, collectionsData, siteContent, settings, rolePermissions] = await Promise.all([
        readCollection('products'), readCollection('collections', 5000), readCollection('site_content', 5000),
        readCollection('settings', 5000), readCollection('rolePermissions', 1000),
      ]);
      downloadJson(`tintin-copia-operativa-${new Date().toISOString().slice(0, 10)}.json`, {
        format: 'tintin-operational-backup', schemaVersion: 1, projectId: PROJECT_ID,
        exportedAt: new Date().toISOString(), exportedBy: state.user.email,
        excludes: ['users', 'orders', 'carts', 'auditLog', 'emailLogs'],
        counts: { products: products.length, collections: collectionsData.length, siteContent: siteContent.length, settings: settings.length, rolePermissions: rolePermissions.length },
        data: { products, collections: collectionsData, siteContent, settings, rolePermissions },
      });
      toast('Copia operativa descargada.');
    } catch (error) {
      console.error('[admin-import] backup failed', error);
      toast(`No se pudo generar la copia: ${error.message}`, true);
    } finally {
      state.busy = false;
      state.ui.backup.disabled = false;
      state.ui.backup.textContent = 'Descargar copia operativa';
    }
  }

  function openLocalDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return resolve(null);
      const request = indexedDB.open(LOCAL_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(LOCAL_STORE, { keyPath: 'jobId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveLocalJob() {
    if (!state.jobId) return;
    const database = await openLocalDb().catch(() => null);
    if (!database) return;
    await new Promise((resolve, reject) => {
      const tx = database.transaction(LOCAL_STORE, 'readwrite');
      tx.objectStore(LOCAL_STORE).put({
        jobId: state.jobId, fileName: state.fileName, fileBytes: state.fileBytes,
        fileChecksum: state.fileChecksum, source: state.source, records: state.records,
        invalidRows: state.invalidRows, job: state.job, savedAt: Date.now(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    }).finally(() => database.close());
  }

  async function loadLocalJobs() {
    const database = await openLocalDb().catch(() => null);
    if (!database) return [];
    return new Promise((resolve, reject) => {
      const request = database.transaction(LOCAL_STORE, 'readonly').objectStore(LOCAL_STORE).getAll();
      request.onsuccess = () => { database.close(); resolve((request.result || []).sort((a, b) => b.savedAt - a.savedAt)); };
      request.onerror = () => { database.close(); reject(request.error); };
    });
  }

  async function clearLocalJob(jobId = state.jobId) {
    const database = await openLocalDb().catch(() => null);
    if (!database || !jobId) return;
    await new Promise(resolve => {
      const tx = database.transaction(LOCAL_STORE, 'readwrite');
      tx.objectStore(LOCAL_STORE).delete(jobId);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    database.close();
  }

  async function fileSampleChecksum(file) {
    if (!crypto?.subtle) return `metadata:${file.name}:${file.size}:${file.lastModified}`;
    const sampleSize = 64 * 1024;
    const start = await file.slice(0, sampleSize).arrayBuffer();
    const end = file.size > sampleSize ? await file.slice(Math.max(0, file.size - sampleSize)).arrayBuffer() : new ArrayBuffer(0);
    const metadata = new TextEncoder().encode(`${file.name}:${file.size}:${file.lastModified}:`);
    const joined = new Uint8Array(metadata.byteLength + start.byteLength + end.byteLength);
    joined.set(metadata);
    joined.set(new Uint8Array(start), metadata.byteLength);
    joined.set(new Uint8Array(end), metadata.byteLength + start.byteLength);
    const digest = await crypto.subtle.digest('SHA-256', joined);
    return `sample-sha256:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
  }

  async function* textChunks(file) {
    if (!file.stream || !window.TextDecoderStream) {
      yield await file.text();
      return;
    }
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        yield result.value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async function csvObjectsFromFile(file) {
    const sample = await file.slice(0, Math.min(file.size, 128 * 1024)).text();
    const delimiter = detectCsvDelimiter(sample);
    const rows = parseDelimitedRowsStream(textChunks(file), delimiter);
    let headers = null;
    const objects = [];
    for await (const values of rows) {
      if (!headers) {
        headers = values.map(value => lower(value).replace(/^\uFEFF/, ''));
        continue;
      }
      const object = {};
      headers.forEach((header, index) => { if (header) object[header] = values[index] ?? ''; });
      objects.push(object);
    }
    if (!headers || !objects.length) throw new Error('El CSV no contiene filas de productos.');
    return objects;
  }

  function jsonRecords(content) {
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) ? parsed : validateOperationalBackupEnvelope(parsed, { projectId: PROJECT_ID, schemaVersion: 1 });
    return list.map((item, index) => {
      const name = cleanImportText(item?.name || item?.title, 240);
      const imageUrl = safeImportUrl(item?.imageUrl || item?.image || '');
      const imagesExtra = (Array.isArray(item?.imagesExtra) ? item.imagesExtra : []).map(safeImportUrl).filter(Boolean);
      const sourceKey = cleanImportText(item?.id || item?.importFingerprint || `${name}-${index + 1}`, 320);
      const product = {
        name, category: cleanImportText(item?.category || item?.collection, 160),
        price: Math.round(Math.max(0, parseLocalizedNumber(item?.price))),
        priceBefore: item?.priceBefore == null ? null : Math.round(Math.max(0, parseLocalizedNumber(item.priceBefore))),
        stock: parseOptionalStock(item?.stock), imageUrl: imageUrl || '', imagesExtra,
        description: sanitizeShopifyBodyHtml(item?.description || item?.body || ''),
        tags: normalizeImportTags(item?.tags), variants: Array.isArray(item?.variants) ? item.variants : [],
        active: item?.active !== false, source: 'json',
        sourceMetadata: { platform: 'tintin', sourceKey }, importFingerprint: buildImportFingerprint('json', sourceKey),
      };
      const errors = [];
      const warnings = [];
      if (!product.name) errors.push('Falta el nombre');
      if (!product.category) errors.push('Falta la colección');
      if (!(product.price > 0)) errors.push('El precio debe ser mayor que cero');
      if (imageUrl === null) errors.push('La URL de imagen no es segura');
      if (!product.imageUrl) warnings.push('Sin imagen principal');
      return { product, errors, warnings, duplicate: false };
    });
  }

  function validateJsonCollections(records) {
    const available = new Map();
    state.collections.forEach(item => {
      [item.id, item.slug, item.name].map(normalizeImportKey).filter(Boolean).forEach(key => {
        if (!available.has(key)) available.set(key, item.slug || item.id || '');
      });
    });
    records.forEach(record => {
      const key = normalizeImportKey(record.product.category);
      const resolved = available.get(key);
      if (resolved) record.product.category = resolved;
      else if (record.product.category) record.errors.push('La colección no existe o requiere mapping explícito');
    });
    return records;
  }

  async function processFile(file) {
    if (!file || state.busy) return;
    if (file.size > MAX_FILE_BYTES) return toast('El archivo supera el límite operativo de 250 MB.', true);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json'].includes(extension)) return toast('Usá un archivo .csv o .json.', true);
    state.ui.drop.classList.add('is-loading');
    state.ui.summary.textContent = 'Analizando archivo por streaming…';
    try {
      state.collections = await readCollection('collections', 5000);
      let grouped;
      if (extension === 'csv') {
        const objects = await csvObjectsFromFile(file);
        grouped = groupShopifyRows(objects, state.collections, { parseNumber: parseLocalizedNumber, parseStock: parseOptionalStock });
      } else {
        grouped = { products: validateJsonCollections(jsonRecords(await file.text())), invalidRows: [] };
      }
      state.records = grouped.products;
      state.invalidRows = grouped.invalidRows;
      state.fileName = file.name;
      state.fileBytes = file.size;
      state.fileChecksum = await fileSampleChecksum(file);
      state.source = extension === 'csv' ? 'shopify-csv' : 'tintin-json';
      state.jobId = '';
      state.job = null;
      renderPreview();
      toast(`Preview listo: ${state.records.length} producto(s) agrupado(s) por Handle.`);
    } catch (error) {
      console.error('[admin-import] parse failed', error);
      state.records = [];
      state.invalidRows = [];
      renderPreview();
      toast(`No se pudo leer el archivo: ${error.message}`, true);
    } finally {
      state.ui.drop.classList.remove('is-loading');
      state.ui.input.value = '';
    }
  }

  function summary() {
    const result = summarizeImportRecords(state.records);
    result.invalid += state.invalidRows.length;
    result.errors = result.invalid;
    result.warnings = state.records.reduce((count, record) => count + (record.warnings?.length || 0), 0);
    result.products = state.records.length;
    return result;
  }

  function statusText(record) {
    if (record.errors?.length) return `ERROR: ${record.errors.join(' · ')}`;
    if (record.duplicate) return 'Duplicado: SKIP por identidad estable';
    if (record.warnings?.length) return `READY · ${record.warnings.join(' · ')}`;
    return 'READY';
  }

  function renderPreview() {
    if (!state.ui) return;
    const totals = summary();
    state.ui.summary.textContent = state.records.length
      ? `${state.fileName} · ${totals.products} producto(s) · ${totals.ready} listos · ${totals.invalid} inválidos · ${totals.images} imágenes · ${totals.variants} variantes`
      : 'Seleccioná un CSV de Shopify o un JSON para comenzar.';
    state.ui.tableBody.replaceChildren();
    state.ui.preview.hidden = !state.records.length;
    state.ui.createJob.disabled = !state.records.length || totals.invalid > 0 || state.busy;
    state.ui.ready.disabled = !state.jobId || totals.invalid > 0 || state.busy || state.job?.status !== 'PREVIEW';
    state.records.slice(0, PREVIEW_ROWS).forEach((record, index) => {
      const row = document.createElement('tr');
      row.append(node('td', '', String(index + 1)), node('td', '', record.product.name || '—'), node('td', '', record.product.category || 'Confirmar colección'), node('td', '', `Gs. ${Number(record.product.price || 0).toLocaleString('es-PY')}`), node('td', '', record.product.stock == null ? 'Sin límite' : String(record.product.stock)), node('td', '', statusText(record)));
      state.ui.tableBody.appendChild(row);
    });
    state.ui.previewNote.textContent = state.records.length > PREVIEW_ROWS
      ? `Vista acotada a ${PREVIEW_ROWS}; el job conserva los ${state.records.length} productos. No se descartan filas.`
      : 'La vista previa no escribe productos ni descarga media.';
    state.ui.jobStatus.textContent = state.job ? `${state.job.status} · ${state.job.jobId || state.jobId}` : 'Sin import job persistido';
  }

  async function apiJob(payload) {
    const response = await authenticatedFetch(JOB_ENDPOINT, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) throw new Error(result.error || apiFailureMessage(response));
    return result.job;
  }

  async function createDryRunJob() {
    if (!isSuperAdmin() || state.busy || !state.records.length) return;
    const totals = summary();
    if (totals.invalid) return toast('Corregí los errores de la vista previa antes de preparar el job.', true);
    state.busy = true;
    state.ui.createJob.disabled = true;
    state.ui.createJob.textContent = 'Guardando preview…';
    try {
      state.jobId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      state.job = await apiJob({ action: 'create', jobId: state.jobId, source: state.source, fileName: state.fileName, fileBytes: state.fileBytes, fileChecksum: state.fileChecksum, total: state.records.length, strategy: 'SKIP', batchCount: chunkImportRecords(state.records, 50).length, summary: totals });
      await saveLocalJob();
      renderPreview();
      toast(`Preview persistido como ${state.jobId}. La migración de catálogo sigue deshabilitada.`);
    } catch (error) {
      console.error('[admin-import] job create failed', error);
      state.jobId = ''; state.job = null;
      toast(`No se pudo persistir el preview: ${error.message}`, true);
    } finally {
      state.busy = false;
      state.ui.createJob.textContent = 'Crear import job (dry-run)';
      renderPreview();
    }
  }

  async function markReady() {
    if (!state.jobId || state.busy || state.job?.status !== 'PREVIEW') return;
    state.busy = true;
    try {
      state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'READY', processed: 0, lastCheckpoint: 0 });
      await saveLocalJob(); renderPreview();
      toast('Job READY. No se ejecutó ninguna escritura de catálogo.');
    } catch (error) { toast(`No se pudo marcar READY: ${error.message}`, true); }
    finally { state.busy = false; renderPreview(); }
  }

  async function restoreLocalJob(saved) {
    if (!saved?.records?.length) return;
    state.fileName = saved.fileName || ''; state.fileBytes = saved.fileBytes || 0; state.fileChecksum = saved.fileChecksum || '';
    state.source = saved.source || 'shopify-csv'; state.records = saved.records; state.invalidRows = saved.invalidRows || [];
    state.jobId = saved.jobId || ''; state.job = saved.job || null;
    if (state.jobId) {
      try { state.job = await apiJob({ action: 'status', jobId: state.jobId }); }
      catch (error) { console.warn('[admin-import] local job status unavailable', error); }
    }
    renderPreview(); toast(`Preview restaurado: ${state.records.length} producto(s).`);
  }

  async function offerLocalResume() {
    const saved = (await loadLocalJobs().catch(() => []))[0];
    if (!saved || !state.ui || !isSuperAdmin()) return;
    state.ui.restore.hidden = false;
    state.ui.restore.textContent = `Restaurar preview ${saved.fileName || saved.jobId}`;
    state.ui.restore.onclick = () => restoreLocalJob(saved);
  }

  function clearPreview() {
    const previousJobId = state.jobId;
    state.records = []; state.invalidRows = []; state.fileName = ''; state.fileBytes = 0; state.fileChecksum = ''; state.source = ''; state.jobId = ''; state.job = null;
    if (previousJobId) clearLocalJob(previousJobId).catch(() => {});
    renderPreview();
  }

  function hideLegacyImporters(section) {
    [...section.querySelectorAll('.adm-card')].forEach(card => {
      const title = lower(card.querySelector('.adm-card-title')?.textContent);
      if (title.includes('importar csv') || title.includes('importar catálogo csv') || title.includes('importar json manual')) {
        card.hidden = true; card.dataset.phase9LegacyImporter = 'disabled';
      }
    });
  }

  function buildPanel() {
    const section = document.getElementById('section-importar');
    if (!section || document.getElementById('shopify-import-canonical-card')) return;
    hideLegacyImporters(section);
    const card = node('div', 'adm-card phase10-card'); card.id = 'shopify-import-canonical-card';
    const head = node('div', 'adm-card-head phase10-head'); const titleWrap = node('div');
    titleWrap.append(node('div', 'adm-card-title', 'Shopify · migración controlada'), node('p', 'phase10-subtitle', 'Auditoría, preview y job reanudable. Esta fase no escribe el catálogo real.'));
    head.append(titleWrap, node('span', 'phase10-badge', 'DRY-RUN'));
    const body = node('div', 'adm-card-body'); const statusGrid = node('div', 'phase10-grid');
    [['Fuente', 'Shopify CSV / JSON'], ['Agrupación', 'Handle → producto'], ['Media', 'validación pendiente'], ['Catálogo', 'sin migración real']].forEach(([label, value]) => { const item = node('div', 'phase10-item'); item.append(node('strong', '', label), node('span', '', value)); statusGrid.appendChild(item); });
    const backupWrap = node('div', 'phase10-backup-wrap'); const backup = node('button', 'adm-btn adm-btn-outline', 'Descargar copia operativa'); backup.type = 'button'; backup.addEventListener('click', exportOperationalBackup); backupWrap.append(node('div', '', 'Copia operativa sin usuarios, pedidos ni auditoría.'), backup);
    const drop = node('div', 'phase10-drop'); drop.tabIndex = 0; drop.setAttribute('role', 'button'); drop.setAttribute('aria-label', 'Seleccionar exportación Shopify CSV o JSON');
    drop.append(node('strong', '', 'Arrastrá un CSV Shopify o JSON'), node('span', '', 'Parser incremental; sin tope artificial de filas. Se conserva Handle, Body HTML permitido, variantes, tags, estado y media detectada.'));
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv,.json,application/json,text/csv'; input.hidden = true; drop.appendChild(input);
    drop.addEventListener('click', () => input.click()); drop.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
    drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('is-dragging'); }); drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging')); drop.addEventListener('drop', event => { event.preventDefault(); drop.classList.remove('is-dragging'); processFile(event.dataTransfer.files?.[0]); }); input.addEventListener('change', () => processFile(input.files?.[0]));
    const summaryEl = node('div', 'phase10-summary', 'Seleccioná un archivo CSV o JSON para comenzar.'); const jobStatus = node('div', 'phase10-job-status', 'Sin import job persistido');
    const preview = node('div', 'phase10-preview'); preview.hidden = true; const tableWrap = node('div', 'adm-table-wrap'); const table = node('table', 'adm-table phase10-table'); const tableHead = document.createElement('thead'); const headRow = document.createElement('tr'); ['#', 'Producto', 'Colección', 'Precio', 'Stock', 'Estado'].forEach(label => headRow.appendChild(node('th', '', label))); tableHead.appendChild(headRow); const tableBody = document.createElement('tbody'); table.append(tableHead, tableBody); tableWrap.appendChild(table); const previewNote = node('small', 'phase10-note');
    const actions = node('div', 'phase10-actions'); const clear = node('button', 'adm-btn adm-btn-outline', 'Limpiar preview'); clear.type = 'button'; clear.addEventListener('click', clearPreview); const createJob = node('button', 'adm-btn adm-btn-primary', 'Crear import job (dry-run)'); createJob.type = 'button'; createJob.addEventListener('click', createDryRunJob); const ready = node('button', 'adm-btn adm-btn-outline', 'Marcar READY'); ready.type = 'button'; ready.addEventListener('click', markReady); const restore = node('button', 'adm-btn adm-btn-outline'); restore.type = 'button'; restore.hidden = true; actions.append(clear, createJob, ready, restore); preview.append(tableWrap, previewNote, actions);
    body.append(statusGrid, backupWrap, drop, summaryEl, jobStatus, preview); card.append(head, body); section.insertBefore(card, section.firstChild);
    state.ui = { section, card, backup, drop, input, summary: summaryEl, jobStatus, preview, tableBody, previewNote, createJob, ready, restore }; renderPreview(); offerLocalResume();
  }

  function injectStyles() {
    if (document.getElementById('phase10-import-styles')) return;
    const style = document.createElement('style'); style.id = 'phase10-import-styles'; style.textContent = `
      .phase10-card{border:1.5px solid #e6b6c7}.phase10-head{align-items:flex-start;gap:12px}.phase10-subtitle{font-size:12px;color:var(--adm-muted);margin:5px 0 0}.phase10-badge{font:800 10px Montserrat;background:#fff3cd;color:#805e00;border-radius:999px;padding:6px 10px}.phase10-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.phase10-item{display:flex;flex-direction:column;gap:4px;padding:12px;background:#fafafa;border:1px solid var(--adm-border);border-radius:10px}.phase10-item strong{font-size:11px;text-transform:uppercase;letter-spacing:.04em}.phase10-item span,.phase10-note,.phase10-job-status{font-size:11px;color:var(--adm-muted);line-height:1.5}.phase10-backup-wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px;border:1px solid var(--adm-border);border-radius:12px;margin-bottom:16px;font-size:12px}.phase10-drop{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center;padding:30px 18px;border:2px dashed #d9a2b7;border-radius:14px;background:#fff8fa;cursor:pointer}.phase10-drop span{font-size:11px;color:var(--adm-muted);max-width:720px}.phase10-drop.is-dragging,.phase10-drop.is-loading{background:#fce7ef;border-color:#b84c72}.phase10-summary{font-size:12px;font-weight:700;margin:14px 0 4px}.phase10-job-status{margin-bottom:8px}.phase10-preview{margin-top:10px}.phase10-table td{vertical-align:middle}.phase10-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px}.adm-toast.phase10-error{background:#a52828!important}@media(max-width:850px){.phase10-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.phase10-grid{grid-template-columns:1fr}.phase10-backup-wrap{align-items:stretch;flex-direction:column}.phase10-backup-wrap button,.phase10-actions button{width:100%}}
    `; document.head.appendChild(style);
  }

  function boot() {
    injectStyles(); buildPanel(); subscribeAuthState(user => { state.user = user; const allowed = isSuperAdmin(); if (state.ui?.card) state.ui.card.hidden = !allowed; if (allowed) offerLocalResume(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}
