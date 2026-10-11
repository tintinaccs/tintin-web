/*
 * Tintin Admin — aplicar al catálogo real un CSV de Shopify ya revisado.
 *
 * Lo monta importacion-admin.js. Un solo botón «Importar al catálogo» exige
 * Super Admin y un preview sin errores; descarga la copia operativa, crea el
 * import job y lo marca READY antes de escribir. Cada lote es
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
} from '../core/store/shopify-import-core.mjs?v=tintin-20261005-import-one-click-1';
import {
  isShopifyMediaUrl,
  rewriteImportedShopifyMedia,
} from '../core/store/shopify-phase2-pipeline.mjs?v=tintin-20260928-shopify-media-migrate-1-loads-20261007-1';
import { confirmDistinctShopifyImport } from '../core/store/shopify-import-identity.mjs?v=tintin-20261004-import-identity-review-1-loads-20261007-1';

const BATCH_SIZE = 50;
const MEDIA_COPY_BATCH_SIZE = 5;
const APPLY_STATES = new Set(['READY', 'RUNNING', 'FAILED']);

export function createCatalogApply({ state, isSuperAdmin, apiJob, authenticatedFetch, saveLocalJob, renderPreview, refreshCatalogIdentitySnapshot, ensureReadyJob, takeBackup, toast, node }) {
  let ui = null;
  let totals = { invalid: 0 };
  // Resultado de la comprobación de imágenes del archivo cargado, para avisar
  // antes del clic si Cloudflare no tiene habilitada la copia a Cloudinary.
  let media = { key: '', status: '', message: '' };

  function collectionOptions() {
    return state.collections
      .map(item => ({ slug: item.slug || item.id, name: item.name || item.slug || item.id }))
      .filter(item => item.slug)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  }

  function applicableRecords() {
    return state.records.filter(record => !record.errors?.length && !record.duplicate);
  }

  async function syncCommittedProducts(ids) {
    if (!ids.size) return true;
    if (typeof window.tintinPushProductsToSheets !== 'function') {
      throw new Error('La sincronización con Sheets no está disponible. Los productos quedaron guardados; recargá y reintentá sin duplicar.');
    }
    return window.tintinPushProductsToSheets([...ids]);
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

  /** Devuelve '' si la copia de imágenes está lista, o el motivo legible si no. */
  async function mediaPreflightProblem() {
    const preflightResponse = await authenticatedFetch('/api/admin-import-media', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'preflight' }),
    });
    const preflight = await preflightResponse.json().catch(() => ({}));
    if (preflightResponse.ok && preflight?.ready === true) return '';
    const reasons = Array.isArray(preflight?.reasons) ? preflight.reasons : [];
    return reasons.includes('MEDIA_COPY_DISABLED')
      ? 'La copia de imágenes está desactivada. Habilitá temporalmente SHOPIFY_PHASE2_MEDIA_WRITE=1 en Cloudflare Pages para esta importación.'
      : reasons.includes('CLOUDINARY_NOT_CONFIGURED')
        ? 'Cloudinary no está configurado en Cloudflare Pages; no se modificó el catálogo.'
        : preflight?.error || `No se pudo preparar la copia de imágenes (HTTP ${preflightResponse.status}).`;
  }

  /** Comprueba una vez por archivo, sin escribir nada, si las imágenes se van a poder copiar. */
  function checkMediaReadiness() {
    if (!isSuperAdmin() || state.source !== 'shopify-csv' || !state.records.length) return;
    const key = `${state.fileChecksum}:${state.records.length}`;
    if (media.key === key) return;
    let count = 0;
    try { count = mediaCandidates(applicableRecords()).length; } catch (error) { media = { key, status: 'blocked', message: error.message }; return; }
    if (!count) { media = { key, status: 'ready', message: '' }; return; }
    media = { key, status: 'checking', message: `Comprobando que las ${count} imagen(es) se puedan copiar…` };
    mediaPreflightProblem()
      .then(problem => { if (media.key === key) media = { key, status: problem ? 'blocked' : 'ready', message: problem || `${count} imagen(es) listas para copiarse a Cloudinary.` }; })
      .catch(error => { if (media.key === key) media = { key, status: 'blocked', message: `No se pudo comprobar la copia de imágenes: ${error.message}` }; })
      .finally(() => { if (media.key === key && !state.busy) renderPreview(); });
  }

  async function copyShopifyMedia(records) {
    const candidates = mediaCandidates(records);
    if (!candidates.length) return records;
    ui.reason.textContent = 'Comprobando que la copia de imágenes esté preparada…';
    const problem = await mediaPreflightProblem();
    if (problem) {
      media = { ...media, status: 'blocked', message: problem };
      throw new Error(problem);
    }
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
    if (totals.invalid > 0) return 'Elegí arriba la colección de los productos marcados (o corregí su precio/stock) para poder importar.';
    if (status === 'COMPLETED') return 'Este archivo ya se importó al catálogo. Para importar otro, limpiá el preview y cargá el nuevo CSV.';
    if (state.jobId && status !== 'PREVIEW' && !APPLY_STATES.has(status)) return `El import job quedó en estado ${status || 'desconocido'}; limpiá el preview y volvé a cargar el CSV.`;
    if (media.status === 'blocked') return media.message;
    if (media.status === 'checking') return media.message;
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
        : 'Estos productos no se reconocieron solos. Elegí la colección del grupo y se aplica a todos sus productos.';
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
    ui.identity.hidden = true;
    ui.apply.hidden = !state.records.length || state.source !== 'shopify-csv';
    if (!state.records.length) return;
    checkMediaReadiness();
    renderMapping();
    renderIdentityReview();
    const unlimited = state.records.filter(record => record.product?.stock == null).length;
    ui.stock.hidden = !unlimited;
    ui.stock.textContent = `${unlimited} producto(s) no traen cantidad de stock en el CSV y quedan «Sin límite». Revisalos después en Productos si querés controlar su stock.`;
    const reason = blockReason();
    ui.button.disabled = Boolean(reason) || state.busy;
    if (!state.busy) {
      const pending = applicableRecords().filter(record => record.identityStatus !== 'MATCHED_EXISTING').length;
      ui.reason.textContent = reason || `Todo listo: se van a crear ${pending} producto(s) nuevos${media.message ? ` · ${media.message}` : ''}. Los que ya existen no se modifican ni se borran.`;
      ui.reason.dataset.state = reason ? 'blocked' : 'ready';
    }
  }

  function renderIdentityReview() {
    const pending = state.records.map((record, index) => ({ record, index })).filter(({ record }) => record.identityStatus === 'REVIEW_REQUIRED');
    ui.identity.hidden = !pending.length;
    ui.identityList.replaceChildren();
    for (const { record, index } of pending) {
      const row = node('div', 'phase10-map-row');
      const label = node('div', 'phase10-map-label');
      const product = record.product || {};
      const candidates = (record.identityCandidates || []).map(candidate => `${candidate.name} · Handle ${candidate.handle || 'sin Handle'} · precio ${candidate.price ?? 'no disponible'}`).join(' / ');
      label.append(node('strong', '', `${product.name || 'Producto sin nombre'} · Handle ${product.sourceMetadata?.handle || product.shopifyHandle || 'sin Handle'} · precio ${product.price ?? 'no disponible'}`), node('span', '', candidates || record.identityError));
      const decision = node('button', 'adm-btn adm-btn-outline', 'Confirmar que es otro producto');
      decision.type = 'button';
      decision.setAttribute('aria-label', `Confirmar otro producto: ${product.name || 'sin nombre'}`);
      decision.disabled = Boolean(state.jobId) || state.busy || !record.identityReviewKey;
      decision.addEventListener('click', async () => {
        if (!isSuperAdmin() || state.jobId || state.busy) return;
        if (!window.confirm(`¿Confirmás que «${product.name}» con Handle «${product.sourceMetadata?.handle || product.shopifyHandle}» es un producto distinto de ${candidates}? Se creará con su propio ID; los existentes se conservan. Esta decisión no escribe el catálogo.`)) return;
        state.busy = true;
        try {
          state.records[index] = confirmDistinctShopifyImport(record);
          await refreshCatalogIdentitySnapshot();
        } catch (error) { toast(`No se pudo confirmar la identidad: ${error.message}`, true); }
        finally { state.busy = false; renderPreview(); }
      });
      row.append(label, decision);
      ui.identityList.appendChild(row);
    }
  }

  async function apply() {
    if (blockReason() || state.busy) return;
    const recordsToConfirm = applicableRecords();
    const confirmed = window.confirm(`Se van a crear hasta ${recordsToConfirm.length} producto(s) en el catálogo real de la tienda.\n\nAntes se descarga una copia de seguridad. Los productos que ya existan no se modifican ni se borran. ¿Continuar?`);
    if (!confirmed || blockReason() || state.busy) return;
    state.busy = true;
    ui.button.textContent = 'Importando…';
    renderPreview();
    let batches = [];
    const seen = new Set();
    const createdIds = [];
    const sheetsIds = new Set();
    let processed = 0;
    let total = state.records.length;
    let skipped = 0;
    // Creados por este mismo job en un intento anterior (reintento tras FAILED).
    let resumed = 0;
    // Fuera del try: el catch informa el avance aunque falle antes de leerlos.
    let records = [];
    try {
      if (!state.backupAt) {
        ui.reason.textContent = 'Descargando la copia de seguridad del catálogo…';
        await takeBackup();
      }
      if (!state.backupAt) throw new Error('No se pudo descargar la copia de seguridad; no se modificó el catálogo');
      if (typeof refreshCatalogIdentitySnapshot === 'function') {
        const refreshedTotals = await refreshCatalogIdentitySnapshot();
        if (refreshedTotals) totals = refreshedTotals;
        if (totals.invalid > 0) {
          throw new Error('El catálogo cambió desde que cargaste el CSV. Revisá los productos marcados antes de volver a aplicar.');
        }
      }
      records = applicableRecords();
      ui.reason.textContent = 'Preparando la importación…';
      await ensureReadyJob();
      if (state.job.status === 'FAILED') state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'READY' });
      if (state.job.status === 'READY') state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'RUNNING', processed: 0, lastCheckpoint: 0 });
      await saveLocalJob();
      // Fresh identity reconciliation omits existing products from create-only
      // batches. Recover this job's committed IDs before that omission loses
      // the pending Sheets push after a closed/interrupted browser session.
      const catalogById = new Map((state.existingProducts || []).map(product => [product.id, product]));
      for (const record of state.records) {
        if (record.errors?.length || record.identityStatus !== 'MATCHED_EXISTING') continue;
        const existing = catalogById.get(record.existingProductId);
        if (existing?.importJobId === state.jobId) sheetsIds.add(record.existingProductId);
      }
      resumed = sheetsIds.size;
      total = state.records.filter(record => !record.errors?.length).length;
      processed = total - records.length;
      skipped = Math.max(0, processed - resumed);
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
        const { createdHere, resumedHere, sheetsHere } = await runTransaction(db, async tx => {
          const refs = entries.map(entry => doc(db, 'products', entry.id));
          const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
          const result = { createdHere: [], resumedHere: 0, sheetsHere: [] };
          snapshots.forEach((snapshot, index) => {
            if (snapshot.exists() && snapshot.data()?.importJobId === state.jobId) {
              result.resumedHere += 1;
              result.sheetsHere.push(entries[index].id);
            }
            if (snapshot.exists()) return;
            tx.set(refs[index], { ...entries[index].data, importJobId: state.jobId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            result.createdHere.push(entries[index].id);
            result.sheetsHere.push(entries[index].id);
          });
          return result;
        });
        createdIds.push(...createdHere);
        sheetsHere.forEach(id => sheetsIds.add(id));
        resumed += resumedHere;
        skipped += entries.length - createdHere.length - resumedHere;
        processed += batch.length;
        ui.reason.textContent = `Aplicando… ${processed}/${total} · ${createdIds.length + resumed} creado(s) · ${skipped} ya existían.`;
      }
      ui.reason.textContent = 'Sincronizando con Google Sheets…';
      const sheetsSynced = await syncCommittedProducts(sheetsIds);
      if (sheetsSynced !== true) throw new Error('Sheets no confirmó la sincronización. El catálogo quedó guardado; podés reintentar sin duplicar productos.');
      const created = createdIds.length + resumed;
      state.job = await apiJob({ action: 'transition', jobId: state.jobId, status: 'COMPLETED', processed, lastCheckpoint: batches.length, created, skipped });
      await saveLocalJob();
      const sheetsText = 'Google Sheets sincronizado';
      ui.reason.textContent = `Listo: ${created} producto(s) creado(s) · ${skipped} ya existían y no se tocaron. Ya están en la web y en el panel; ${sheetsText}.`;
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
      if (sheetsIds.size) {
        try { await syncCommittedProducts(sheetsIds); }
        catch (syncError) { console.error('[admin-import] could not sync committed products to Sheets', syncError); }
      }
      ui.reason.textContent = `Se detuvo en ${processed}/${total}: ${error.message}. Lo creado quedó guardado; reintentar no duplica.`;
      toast(`La aplicación se detuvo: ${error.message}. Podés reintentar sin duplicar productos.`, true);
    } finally {
      state.busy = false;
      ui.button.textContent = 'Importar al catálogo';
      const message = ui.reason.textContent;
      renderPreview();
      ui.reason.textContent = message;
    }
  }

  function mount(preview, before) {
    const identity = node('div', 'phase10-map'); identity.hidden = true;
    const identityList = node('div', 'phase10-map-list');
    identity.append(node('strong', 'phase10-map-title', 'Identidades a confirmar'), node('p', 'phase10-note', 'Un nombre o SKU coincidente requiere revisión. Confirmar otro producto conserva ambos IDs y exige una comprobación fresca antes de aplicar.'), identityList);
    preview.insertBefore(identity, before);
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
    const button = node('button', 'adm-btn adm-btn-primary', 'Importar al catálogo');
    button.type = 'button';
    button.addEventListener('click', apply);
    row.append(reason, button);
    applyBox.append(node('strong', 'phase10-map-title', 'Importar al catálogo'), stock, row);
    preview.appendChild(applyBox);
    ui = { identity, identityList, mapping, mapHint, mapList, apply: applyBox, stock, reason, button };
  }

  return { mount, render };
}
