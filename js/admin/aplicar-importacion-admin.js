/*
 * Tintin Admin — aplicar al catálogo real un CSV de Shopify ya revisado.
 *
 * Lo monta importacion-admin.js. Exige Super Admin, la copia operativa
 * descargada en esta sesión y un import job READY sin errores. Cada lote es
 * una transacción que primero lee y después crea solo los productos que no
 * existen (id estable por Handle): reintentar nunca duplica, nunca pisa un
 * producto ya editado y nunca borra nada. No escribe el inventario privado.
 */

import { db } from '../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  assignGroupCollection,
  buildCatalogProductFromImport,
  chunkImportRecords,
  pendingCollectionGroups,
  stableProductDocumentId,
} from '../core/store/shopify-import-core.mjs?v=tintin-20260927-shopify-apply-1';
import {
  isShopifyMediaUrl,
  rewriteImportedShopifyMedia,
} from '../core/store/shopify-phase2-pipeline.mjs?v=tintin-20260928-shopify-media-migrate-1';

const BATCH_SIZE = 50;
const MEDIA_COPY_BATCH_SIZE = 5;
const APPLY_STATES = new Set(['READY', 'RUNNING', 'FAILED']);

export function createCatalogApply({ state, isSuperAdmin, apiJob, authenticatedFetch, saveLocalJob, renderPreview, toast, node }) {
  let ui = null;
  let totals = { invalid: 0 };

  function collectionOptions() {
    return state.collections
      .map(item => ({ slug: item.slug || item.id, name: item.name || item.slug || item.id }))
      .filter(item => item.slug)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  }

  function applicableRecords() {
    return state.records.filter(record => !record.errors?.length && !record.duplicate);
  }

  function mediaCandidates(records) {
    const candidates = new Map();
    for (const record of records) {
      const product = record?.product || record;
      const urls = [product?.imageUrl, ...(Array.isArray(product?.imagesExtra) ? product.imagesExtra : []),
        ...(Array.isArray(product?.variants) ? product.variants.map(variant => variant?.imageUrl) : [])];
      for (const sourceValue of urls.filter(value => typeof value === 'string' && isShopifyMediaUrl(value))) {
        let parsed;
        try { parsed = new URL(sourceValue, location.href); } catch { throw new Error('Una URL de imagen de Shopify no es válida.'); }
        if (parsed.protocol === 'http:') parsed.protocol = 'https:';
        if (parsed.protocol !== 'https:') throw new Error('Las imágenes de Shopify deben usar HTTPS.');
        const sourceUrl = parsed.href;
        let candidate = candidates.get(sourceUrl);
        if (!candidate) {
          candidate = {
            mediaId: stableProductDocumentId(`shopify-media:${sourceUrl}`),
            sourceUrl,
            sourceValues: new Set(),
          };
          candidates.set(sourceUrl, candidate);
        }
        candidate.sourceValues.add(sourceValue);
      }
    }
    return [...candidates.values()];
  }

  async function copyShopifyMedia(records) {
    const candidates = mediaCandidates(records);
    if (!candidates.length) return records;
    const copiedBySourceUrl = new Map();
    for (let offset = 0; offset < candidates.length; offset += MEDIA_COPY_BATCH_SIZE) {
      const batch = candidates.slice(offset, offset + MEDIA_COPY_BATCH_SIZE);
      ui.reason.textContent = `Copiando imágenes fuera de Shopify… ${Math.min(offset + batch.length, candidates.length)}/${candidates.length}`;
      const response = await authenticatedFetch('/api/admin-import-media', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          media: batch.map((item, index) => ({ mediaId: item.mediaId, sourceUrl: item.sourceUrl, position: offset + index, featured: offset + index === 0 })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true || !Array.isArray(result?.media)) {
        throw new Error(result?.error || `No se pudieron copiar las imágenes a Cloudinary (HTTP ${response.status}).`);
      }
      const byId = new Map(result.media.map(item => [item.mediaId, item]));
      for (const candidate of batch) {
        const copied = byId.get(candidate.mediaId);
        if (copied?.state !== 'COPIED' || !copied.canonicalUrl) {
          throw new Error(`No se pudo copiar una imagen de Shopify (${copied?.errorCode || 'sin confirmación'}). No se escribió el catálogo.`);
        }
        for (const sourceValue of candidate.sourceValues) copiedBySourceUrl.set(sourceValue, copied);
      }
    }
    const rewritten = rewriteImportedShopifyMedia(records, copiedBySourceUrl);
    ui.reason.textContent = `${candidates.length} imagen(es) copiadas y verificadas en Cloudinary. Guardando el catálogo…`;
    return rewritten;
  }

  function blockReason() {
    const status = state.job?.status || '';
    if (!isSuperAdmin()) return 'Solo el Super Admin puede aplicar la importación.';
    if (state.source !== 'shopify-csv') return 'Solo un CSV exportado de Shopify se aplica al catálogo.';
    if (totals.invalid > 0) return 'Resolvé primero los productos con error (colección, precio o stock).';
    if (!state.jobId) return 'Creá el import job y marcalo READY.';
    if (status === 'COMPLETED') return 'Este import job ya se aplicó al catálogo.';
    if (!APPLY_STATES.has(status)) return 'Marcá el import job como READY para habilitar la aplicación.';
    if (!state.backupAt) return 'Descargá la copia operativa en esta sesión antes de aplicar.';
    return '';
  }

  function renderMapping() {
    const groups = pendingCollectionGroups(state.records);
    const options = collectionOptions();
    const locked = Boolean(state.jobId) || state.busy;
    ui.mapping.hidden = !groups.length;
    ui.mapList.replaceChildren();
    if (!groups.length) return;
    ui.mapHint.textContent = !options.length
      ? 'No hay colecciones creadas. Creálas primero en Colecciones → «Importar las 12 colecciones actuales» y volvé a cargar el CSV.'
      : locked
        ? 'El import job ya se creó con estas colecciones. Para cambiarlas, limpiá el preview y volvé a cargar el CSV.'
        : 'Estos productos no se reconocieron solos. Elegí la colección de cada grupo; se aplica a todos los productos del grupo.';
    groups.forEach(entry => {
      const row = node('div', 'phase10-map-row');
      const label = node('div', 'phase10-map-label');
      label.append(node('strong', '', `«${entry.group || 'sin título'}» · ${entry.count} producto(s)`), node('span', '', `Ej.: ${entry.sample || '—'}`));
      const select = document.createElement('select');
      select.className = 'adm-select phase10-map-select';
      select.setAttribute('aria-label', `Colección para el grupo ${entry.group || 'sin título'}`);
      select.disabled = locked || !options.length;
      const placeholder = new Option('Elegí una colección…', '');
      placeholder.disabled = true;
      select.appendChild(placeholder);
      options.forEach(item => select.appendChild(new Option(entry.suggestions.includes(item.slug) ? `${item.name} (sugerida)` : item.name, item.slug)));
      select.value = entry.category || '';
      select.addEventListener('change', () => {
        if (state.jobId || state.busy) return;
        assignGroupCollection(state.records, entry.group, select.value, state.collections);
        renderPreview();
      });
      row.append(label, select);
      ui.mapList.appendChild(row);
    });
  }

  function render(currentTotals) {
    if (!ui) return;
    totals = currentTotals || totals;
    ui.mapping.hidden = true;
    ui.apply.hidden = !state.records.length || state.source !== 'shopify-csv';
    if (!state.records.length) return;
    renderMapping();
    const unlimited = state.records.filter(record => record.product?.stock == null).length;
    ui.stock.hidden = !unlimited;
    ui.stock.textContent = `${unlimited} producto(s) no traen cantidad de stock en el CSV y quedan «Sin límite». Revisalos después en Productos si querés controlar su stock.`;
    const reason = blockReason();
    ui.button.disabled = Boolean(reason) || state.busy;
    if (!state.busy) {
      ui.reason.textContent = reason || `Crea hasta ${applicableRecords().length} producto(s) nuevos en el catálogo real. Los que ya existen no se modifican ni se borran.`;
    }
  }

  async function apply() {
    if (blockReason() || state.busy) return;
    const records = applicableRecords();
    const confirmed = window.confirm(`Se van a crear hasta ${records.length} producto(s) en el catálogo real de la tienda.\n\nLos productos que ya existan no se modifican ni se borran. ¿Continuar?`);
    if (!confirmed || blockReason() || state.busy) return;
    state.busy = true;
    ui.button.textContent = 'Aplicando…';
    renderPreview();
    let batches = [];
    const seen = new Set();
    const createdIds = [];
    let processed = 0;
    let skipped = 0;
    // Creados por este mismo job en un intento anterior (reintento tras FAILED).
    let resumed = 0;
    try {
      if (state.job.status === 'FAILED') state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'READY' });
      if (state.job.status === 'READY') state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'RUNNING', processed: 0, lastCheckpoint: 0 });
      await saveLocalJob();
      const independentRecords = await copyShopifyMedia(records);
      batches = chunkImportRecords(independentRecords, BATCH_SIZE);
      for (const batch of batches) {
        const entries = [];
        batch.forEach(record => {
          const id = stableProductDocumentId(record.product.importFingerprint);
          if (seen.has(id)) { skipped += 1; return; }
          seen.add(id);
          entries.push({ id, data: buildCatalogProductFromImport(record.product) });
        });
        const { createdHere, resumedHere } = await runTransaction(db, async tx => {
          const refs = entries.map(entry => doc(db, 'products', entry.id));
          const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
          const result = { createdHere: [], resumedHere: 0 };
          snapshots.forEach((snapshot, index) => {
            if (snapshot.exists() && snapshot.data()?.importJobId === state.jobId) result.resumedHere += 1;
            if (snapshot.exists()) return;
            tx.set(refs[index], { ...entries[index].data, importJobId: state.jobId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            result.createdHere.push(entries[index].id);
          });
          return result;
        });
        createdIds.push(...createdHere);
        resumed += resumedHere;
        skipped += entries.length - createdHere.length - resumedHere;
        processed += batch.length;
        ui.reason.textContent = `Aplicando… ${processed}/${records.length} · ${createdIds.length + resumed} creado(s) · ${skipped} ya existían.`;
      }
      await window.tintinPushProductsToSheets?.(createdIds);
      const created = createdIds.length + resumed;
      state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'COMPLETED', processed, lastCheckpoint: batches.length, created, skipped });
      await saveLocalJob();
      ui.reason.textContent = `Listo: ${created} producto(s) creado(s) · ${skipped} ya existían y no se tocaron.`;
      toast(`Catálogo actualizado: ${created} producto(s) creado(s), ${skipped} ya existían.`);
    } catch (error) {
      console.error('[admin-import] catalog apply failed', error);
      if (state.job?.status === 'RUNNING') {
        try {
          state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'FAILED', processed, error: error.message });
          await saveLocalJob();
        } catch (transitionError) {
          console.error('[admin-import] could not mark job FAILED', transitionError);
        }
      }
      if (createdIds.length) await window.tintinPushProductsToSheets?.(createdIds);
      ui.reason.textContent = `Se detuvo en ${processed}/${records.length}: ${error.message}. Lo creado quedó guardado; reintentar no duplica.`;
      toast(`La aplicación se detuvo: ${error.message}. Podés reintentar sin duplicar productos.`, true);
    } finally {
      state.busy = false;
      ui.button.textContent = 'Aplicar al catálogo';
      const message = ui.reason.textContent;
      renderPreview();
      ui.reason.textContent = message;
    }
  }

  function mount(preview, before) {
    const mapping = node('div', 'phase10-map');
    mapping.hidden = true;
    const mapHint = node('p', 'phase10-note');
    const mapList = node('div', 'phase10-map-list');
    mapping.append(node('strong', 'phase10-map-title', 'Colecciones a confirmar'), mapHint, mapList);
    preview.insertBefore(mapping, before);

    const applyBox = node('div', 'phase10-apply');
    applyBox.hidden = true;
    const stock = node('p', 'phase10-note');
    stock.hidden = true;
    const row = node('div', 'phase10-apply-row');
    const reason = node('p', 'phase10-note');
    reason.setAttribute('role', 'status');
    reason.setAttribute('aria-live', 'polite');
    const button = node('button', 'adm-btn adm-btn-primary', 'Aplicar al catálogo');
    button.type = 'button';
    button.addEventListener('click', apply);
    row.append(reason, button);
    applyBox.append(node('strong', 'phase10-map-title', 'Aplicar al catálogo real'), stock, row);
    preview.appendChild(applyBox);
    ui = { mapping, mapHint, mapList, apply: applyBox, stock, reason, button };
  }

  return { mount, render };
}
