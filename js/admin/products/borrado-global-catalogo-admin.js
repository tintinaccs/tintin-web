/* =============================================================
   TINTIN — Borrado global canónico de Productos y Colecciones
   Solo Super Admin. Todo borrado destructivo pasa por Cloudflare para
   coordinar Firestore + inventario + social + Google Sheets.
   ============================================================= */

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1';
import { isSuperAdmin } from '../../core/auth/identidad-super-admin.js?v=tintin-20260916-superadmin-identity-2';
import { notify, runOperation, GLOBAL_STATUS } from '../operaciones/sistema-operaciones-admin.js?v=tintin-20260925-admin-ops-1';
import { DIAGNOSIS_KIND } from '../operaciones/nucleo-operaciones.js?v=tintin-20260925-admin-ops-1';

const API = '/api/admin-catalog-delete';
const COLLECTION_CONFIRM = 'ELIMINAR COLECCIONES DEFINITIVAMENTE';
const ALL_COLLECTIONS_CONFIRM = 'ELIMINAR TODAS LAS COLECCIONES';

const MODULE = 'Catálogo · borrado global';
const SOURCE = 'Panel admin';
const SERVER = 'Cloudflare /api/admin-catalog-delete → Firestore';
const SHEETS = 'Google Sheets (Apps Script)';
const SERVER_REPORT = 'Cloudflare (respuesta de la purga)';
// Texto exacto con el que cloudflare/borrado-global-catalogo.js informa el
// fallo del lote social; el resto de errores corresponde a la hoja Productos.
const SOCIAL_SHEETS_ERROR = 'Algunas filas sociales no pudieron sincronizarse con Google Sheets.';
const MAX_QUEUE_ROUNDS = 10;

const toast = (message, options) => notify(message, options);

function requestDeletePassword() {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'border:0;border-radius:16px;padding:24px;max-width:420px;width:calc(100% - 32px);box-shadow:0 20px 70px rgba(0,0,0,.28);font-family:Montserrat;color:#2b2025;';
    dialog.innerHTML = `
      <form method="dialog" style="display:grid;gap:14px">
        <strong style="font-size:18px">Confirmación de seguridad</strong>
        <p style="margin:0;line-height:1.45">Escribí tu contraseña secreta para confirmar el borrado definitivo.</p>
        <label style="display:grid;gap:6px;font-weight:700;font-size:13px">
          Contraseña
          <input type="password" name="password" autocomplete="off" spellcheck="false" required
            style="min-height:42px;border:1px solid #c9aab5;border-radius:9px;padding:8px 10px;font-family:Montserrat">
        </label>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button value="cancel" type="submit" style="min-height:40px;border:1px solid #c9aab5;border-radius:9px;padding:8px 14px;background:#fff;color:#2b2025 !important;opacity:1 !important;visibility:visible !important;display:inline-flex;align-items:center;justify-content:center;text-indent:0;line-height:1.2;font-family:Montserrat;cursor:pointer">Cancelar</button>
          <button value="confirm" type="submit" style="min-height:40px;border:0;border-radius:9px;padding:8px 14px;background:#9b405a;color:#fff !important;opacity:1 !important;visibility:visible !important;display:inline-flex;align-items:center;justify-content:center;text-indent:0;line-height:1.2;font-family:Montserrat;font-weight:700;cursor:pointer">Confirmar</button>
        </div>
      </form>`;
    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input[name="password"]');
    const finish = event => {
      event.preventDefault();
      const value = event.submitter?.value === 'confirm' ? input.value : null;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    form.addEventListener('submit', finish);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish({ submitter: { value: 'cancel' } }); }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
  });
}

// Los errores llevan endpoint, estado HTTP y código para el diagnóstico.
function catalogApiError(message, status = 0, code = '') {
  const error = new Error(message);
  error.endpoint = API;
  if (status) error.status = status;
  if (code) error.code = code;
  return error;
}

async function postCatalogDelete(payload) {
  const user = auth.currentUser;
  if (!isSuperAdmin(user)) throw catalogApiError('Esta acción es exclusiva del Super Admin.', 0, 'permission-denied');
  const idToken = await user.getIdToken();
  let response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw catalogApiError(`Sin respuesta del servidor: ${error?.message || 'error de red'}`, 0, 'network-request-failed');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 207) throw catalogApiError(data.error || `Error ${response.status}`, response.status);
  if (!data.result) throw catalogApiError(data.error || 'El servidor no devolvió el resultado de la purga.', response.status, 'missing-result');
  return { ...data.result, partial: data.partial === true || data.result.partial === true };
}

function selectedProductIds() {
  // El admin puede renderizar la tabla legacy (.prod-row-check) o la tabla
  // Shopify (.tt-commerce-table [data-select-product]). Ambos muestran la
  // misma selección, pero el segundo no tiene data-id.
  const ids = new Set();
  document.querySelectorAll('.prod-row-check:checked, [data-select-product]:checked')
    .forEach(input => {
      const id = String(input.dataset.id || input.dataset.selectProduct || '').trim();
      if (id) ids.add(id);
    });
  return [...ids];
}

function selectedCollectionSlugs() {
  return [...document.querySelectorAll('.coll-row-check:checked')]
    .map(input => String(input.dataset.slug || '').trim()).filter(Boolean);
}

function impactProductText(result) {
  const impact = result?.impact || {};
  return [
    `${impact.products || 0} producto(s)`,
    `${impact.reviewRecords || 0} reseña(s) canónicas`,
    `${impact.reviewCopies || 0} copia(s) de reseñas`,
    `${impact.likeRecords || 0} me gusta/interacción(es)`,
    `${impact.interactionMappings || 0} mapa(s) de interacción`,
    'inventario + contadores sociales + Google Sheets',
  ].join('\n• ');
}

function deletionStages(firestore) {
  return [
    { id: 'preview', label: 'Calcular impacto', source: SOURCE, destination: `${API} (simulación)`, expected: 'Impacto calculado por el servidor' },
    { id: 'confirm', label: 'Confirmación del Super Admin', source: SOURCE, expected: 'Confirmación explícita', dependsOn: ['preview'] },
    { id: 'firestore', source: SOURCE, destination: SERVER, dependsOn: ['confirm'], ...firestore },
    { id: 'sheets-products', label: 'Google Sheets · Productos', source: SERVER_REPORT, destination: SHEETS, expected: 'Hoja Productos actualizada', dependsOn: ['firestore'] },
    { id: 'sheets-social', label: 'Google Sheets · Reseñas y me gusta', source: SERVER_REPORT, destination: SHEETS, expected: 'Filas sociales de los productos eliminados limpiadas', dependsOn: ['firestore'] },
  ];
}

// Una falla del POST destructivo no prueba que el servidor no haya borrado.
const UNCERTAIN_DELETION = 'No se pudo confirmar el resultado. Si el servidor alcanzó a aplicar el borrado (total o parcial), «Reintentar» lo comprueba primero y no vuelve a borrar lo que ya no existe.';

/**
 * Traduce la respuesta real del servidor a las etapas de Sheets. Devuelve si
 * la hoja Productos quedó pendiente en la cola persistente, que es lo único
 * que «Reintentar» puede cerrar sin repetir el borrado.
 */
function reportSheets(ctx, result, { productRows, socialPurged }) {
  const errors = (Array.isArray(result?.errors) ? result.errors : []).filter(Boolean).map(String);
  const productErrors = errors.filter(message => message !== SOCIAL_SHEETS_ERROR);
  let queued = false;

  if (!productRows) ctx.skip('sheets-products', 'No aplica: ningún producto cambió.');
  else {
    ctx.start('sheets-products');
    if (result?.sheets?.products === true) {
      ctx.ok('sheets-products', {
        received: result.preflightRecovered
          ? `${productRows} fila(s) confirmadas por Apps Script (la sonda previa había fallado y el cierre final se recuperó)`
          : `${productRows} fila(s) confirmadas por Apps Script`,
      });
    } else {
      const detected = productErrors.join('\n') || 'Apps Script no confirmó la actualización de la hoja Productos.';
      queued = !/no se pudo encolar/i.test(detected);
      ctx.warn('sheets-products', {
        received: 'Sin confirmación de Apps Script',
        detail: queued
          ? `${detected}\n\nFirestore ya quedó actualizado. «Reintentar» reenvía a Sheets la cola pendiente sin volver a borrar nada; la cola programada también la reintenta cada 15 minutos.`
          : `${detected}\n\nFirestore ya quedó actualizado, pero el reintento no quedó registrado: hay que revisar manualmente esas filas en la hoja Productos.`,
        affected: `${productRows} fila(s) de la hoja Productos`,
        diagnosis: [{ kind: DIAGNOSIS_KIND.DETECTED, text: detected }],
      });
    }
  }

  const reviews = Number(socialPurged?.reviewRecords) || 0;
  const likes = Number(socialPurged?.likes) || 0;
  if (!socialPurged) ctx.skip('sheets-social', 'No aplica: no se eliminaron productos.');
  else if (!reviews && !likes && result?.sheets?.social !== false) ctx.skip('sheets-social', 'No había reseñas ni me gusta de estos productos.');
  else {
    ctx.start('sheets-social');
    if (result?.sheets?.social === false) {
      ctx.warn('sheets-social', {
        received: 'Sin confirmación de Apps Script',
        detail: `${SOCIAL_SHEETS_ERROR}\n\nEstas filas no tienen cola de reintento: hay que revisarlas manualmente en las hojas de participación.`,
        affected: `${reviews} reseña(s) y ${likes} me gusta en Google Sheets`,
        diagnosis: [
          { kind: DIAGNOSIS_KIND.DETECTED, text: SOCIAL_SHEETS_ERROR },
          { kind: DIAGNOSIS_KIND.UNKNOWN, text: 'El servidor no informa la causa: Apps Script no respondió, rechazó el lote o falta el secreto de sincronización en Cloudflare.' },
        ],
      });
    } else {
      ctx.ok('sheets-social', { received: `${reviews} reseña(s) y ${likes} me gusta limpiados en Sheets` });
    }
  }
  return { queued };
}

function stageStatus(operation, id) {
  return operation?.stages?.find(stage => stage.id === id)?.status;
}

/** Reenvía la cola persistente catalogSheetSyncQueue. No borra nada. */
async function retryPendingSheets(retryOf = null) {
  let total = 0;
  let remaining = 0;
  const outcome = await runOperation({
    name: 'ReintentarSheetsCatalogo',
    title: 'Reintentar sincronización con Google Sheets',
    module: MODULE,
    retryOf,
    notifySuccess: false,
    stages: [{ id: 'queue', label: 'Reenviar la cola pendiente a Google Sheets', source: SOURCE, destination: `${API} (retryPending) → ${SHEETS}`, expected: 'Cola vacía' }],
    run: async ctx => {
      ctx.start('queue');
      let resolved = 0;
      // El servidor cierra una tarea por llamada; se repite mientras avance.
      for (let round = 0; round < MAX_QUEUE_ROUNDS; round += 1) {
        const result = await postCatalogDelete({ action: 'retryPending' });
        if (round === 0) total = Number(result.pending) || 0;
        resolved += Number(result.resolved) || 0;
        remaining = Number(result.remaining) || 0;
        ctx.progress('queue', Math.min(resolved, total), total);
        if (!remaining || !Number(result.resolved)) break;
      }
      if (!total) { ctx.ok('queue', { received: 'La cola ya estaba vacía: no quedaba nada pendiente.' }); return; }
      const received = `${resolved} de ${total} tarea(s) sincronizadas; ${remaining} pendiente(s)`;
      if (!remaining) { ctx.ok('queue', { received }); return; }
      const info = {
        received,
        detail: 'Google Sheets siguió sin confirmar algunas tareas. Quedan en la cola y la cola programada las vuelve a intentar.',
        affected: `${remaining} tarea(s) de la cola catalogSheetSyncQueue`,
        diagnosis: [{ kind: DIAGNOSIS_KIND.DETECTED, text: `El servidor informó ${remaining} tarea(s) sin cerrar.` }],
      };
      if (resolved) ctx.warn('queue', info);
      else ctx.fail('queue', info);
    },
    retry: operation => retryPendingSheets(operation.id),
  });
  if (outcome.status === GLOBAL_STATUS.GREEN) {
    toast(total ? `Google Sheets sincronizado: ${total} tarea(s) cerradas.` : 'No había sincronizaciones pendientes con Google Sheets.', { type: 'success' });
  }
  return outcome;
}

/**
 * Reintento de un borrado. Si la hoja quedó pendiente, solo reenvía la cola.
 * Si el paso destructivo falló, primero comprueba qué sigue existiendo: lo que
 * ya no existe no se vuelve a borrar y se pasa a sincronizar Sheets.
 */
function deletionRetry(checkRemaining, rerun) {
  const plans = new Map();
  const planFor = async operation => {
    if (stageStatus(operation, 'sheets-products') === 'warning') return { kind: 'sheets' };
    if (stageStatus(operation, 'firestore') === 'error') {
      return await checkRemaining() ? { kind: 'rerun' } : { kind: 'sheets', alreadyApplied: true };
    }
    // Falló antes de borrar (impacto o confirmación): repetir es seguro y
    // vuelve a pedir la confirmación completa.
    return { kind: 'rerun' };
  };
  return {
    checkBeforeRetry: async operation => {
      plans.set(operation.id, await planFor(operation));
      return { ok: true };
    },
    retry: async operation => {
      const plan = plans.get(operation.id) || await planFor(operation);
      plans.delete(operation.id);
      if (plan.kind === 'sheets') {
        if (plan.alreadyApplied) toast('Comprobado: el borrado ya se había aplicado en Firestore. Se reintenta solo la sincronización con Google Sheets.', { type: 'info', duration: 6000 });
        return retryPendingSheets(operation.id);
      }
      return rerun(operation.id);
    },
  };
}

function uncertainFailure(ctx, error) {
  ctx.fail('firestore', { error, affected: UNCERTAIN_DELETION });
}

function dispatchCatalogMutated(type, result) {
  window.dispatchEvent(new CustomEvent('tintin:catalog-mutated', { detail: { type, result } }));
}

async function executeProductDeletion({ scope, productIds = [], label = '' }, { retryOf = null } = {}) {
  let deleted = 0;
  const count = productIds.length;
  const title = scope === 'all'
    ? 'Eliminar todos los productos'
    : count === 1 ? `Eliminar producto${label ? ` «${label}»` : ''}` : `Eliminar ${count} productos`;
  const retry = deletionRetry(
    async () => {
      const preview = await postCatalogDelete({ action: 'deleteProducts', scope, productIds, dryRun: true });
      return Array.isArray(preview?.productIds) ? preview.productIds.length : 0;
    },
    retryOf => executeProductDeletion({ scope, productIds, label }, { retryOf }),
  );
  const outcome = await runOperation({
    name: 'EliminarProductos',
    title,
    module: MODULE,
    dangerous: true,
    retryOf,
    notifySuccess: false,
    stages: deletionStages({ label: 'Eliminar productos en Firestore', expected: 'Productos, inventario y referencias sociales eliminados' }),
    ...retry,
    run: async ctx => {
      ctx.start('preview');
      const preview = await postCatalogDelete({ action: 'deleteProducts', scope, productIds, dryRun: true });
      const canonicalIds = Array.isArray(preview?.productIds) ? preview.productIds : [];
      const n = canonicalIds.length;
      ctx.ok('preview', { received: `${n} producto(s) a eliminar`, detail: n ? `• ${impactProductText(preview)}` : '' });
      if (!n) { toast('No hay productos para eliminar.', { type: 'info' }); ctx.cancel('No había productos para eliminar.'); }

      ctx.start('confirm');
      const heading = scope === 'all' ? `Vas a eliminar TODOS los ${n} productos actuales.` : `Vas a eliminar ${n} producto(s)${label ? `: ${label}` : ''}.`;
      if (!window.confirm(`${heading}\n\nTambién se purgará:\n• ${impactProductText(preview)}\n\nLos pedidos históricos y el audit log se conservan como comprobantes.`)) ctx.cancel('Cancelada por el usuario.');
      const typed = await requestDeletePassword();
      if (!typed) { toast('Confirmación cancelada. No se eliminó nada.', { type: 'info' }); ctx.cancel('Contraseña no ingresada.'); }
      ctx.ok('confirm', { received: 'Confirmado con contraseña secreta' });

      // Una única operación de servidor vuelve a resolver los IDs canónicos,
      // limpia referencias y elimina Firestore en commits limitados. Dividirlo
      // en POST independientes repetía lecturas sociales y sondas Sheets, y
      // podía dejar productos solo parcialmente eliminados.
      ctx.start('firestore');
      let result;
      try {
        result = await postCatalogDelete({
          action: 'deleteProducts', scope, productIds: canonicalIds,
          dryRun: false, confirmation: typed,
        });
      } catch (error) { uncertainFailure(ctx, error); return; }
      deleted = Number(result.deletedProducts) || 0;
      const received = `${deleted} producto(s) y ${Number(result.deletedFirestoreDocuments) || 0} documento(s) de Firestore eliminados`;
      if (deleted < n) ctx.warn('firestore', { received, detail: `${n - deleted} producto(s) ya no existían cuando el servidor ejecutó el borrado.` });
      else ctx.ok('firestore', { received });
      if (deleted > 0) dispatchCatalogMutated('products', result);

      const { queued } = reportSheets(ctx, result, { productRows: deleted, socialPurged: deleted ? result.socialPurged : null });
      if (!queued) ctx.disableRetry();
    },
  });
  if (outcome.status === GLOBAL_STATUS.GREEN) toast(`${deleted} producto(s) eliminados globalmente`, { type: 'success' });
  return outcome.status === GLOBAL_STATUS.GREEN;
}

function chooseCollectionProductMode(affectedProducts) {
  if (!affectedProducts) return { productMode: 'unassign', targetCollection: '' };
  const answer = window.prompt(
    `Las colecciones contienen ${affectedProducts} producto(s).\n\n` +
    'Escribí exactamente una opción:\n' +
    'CONSERVAR PRODUCTOS = elimina las colecciones y deja esos productos sin colección.\n' +
    'ELIMINAR PRODUCTOS = elimina también esos productos globalmente.',
    'CONSERVAR PRODUCTOS'
  );
  if (answer === null) return null;
  const normalized = answer.trim().toUpperCase();
  if (normalized === 'CONSERVAR PRODUCTOS') return { productMode: 'unassign', targetCollection: '' };
  if (normalized === 'ELIMINAR PRODUCTOS') return { productMode: 'delete', targetCollection: '' };
  toast('Opción no reconocida. Operación cancelada.', { type: 'warning' });
  return null;
}

function collectionFirestoreReceived(result) {
  const affected = Number(result.affectedProducts) || 0;
  const mode = result.productMode === 'delete'
    ? `${Number(result.deletedProducts) || 0} producto(s) eliminados`
    : result.productMode === 'reassign'
      ? `${affected} producto(s) movidos a «${result.targetCollection}»`
      : `${affected} producto(s) conservados sin colección`;
  return `${Number(result.deletedCollections) || 0} colección(es) eliminadas; ${mode}`;
}

/** Cierra las etapas posteriores al POST destructivo de colecciones. */
function reportCollectionResult(ctx, result, expectedCollections) {
  const deletedCollections = Number(result.deletedCollections) || 0;
  const received = collectionFirestoreReceived(result);
  if (deletedCollections < expectedCollections) {
    ctx.warn('firestore', { received, detail: `${expectedCollections - deletedCollections} colección(es) ya no existían cuando el servidor ejecutó el borrado.` });
  } else ctx.ok('firestore', { received });
  dispatchCatalogMutated('collections', result);
  const deletedProducts = result.productMode === 'delete';
  const productRows = deletedProducts ? Number(result.deletedProducts) || 0 : Number(result.affectedProducts) || 0;
  const socialPurged = deletedProducts && Number(result.deletedProducts) > 0 ? result.productPurge?.socialPurged || null : null;
  return reportSheets(ctx, result, { productRows, socialPurged });
}

async function collectionsRemaining(scope, slugs) {
  const preview = await postCatalogDelete({ action: 'deleteCollections', scope, slugs, productMode: 'unassign', dryRun: true });
  return Number(preview?.impact?.collections) || 0;
}

async function executeCollectionDeletion({ scope, slugs = [] }, { retryOf = null } = {}) {
  let deletedCollections = 0;
  const retry = deletionRetry(
    () => collectionsRemaining(scope, slugs),
    retryOf => executeCollectionDeletion({ scope, slugs }, { retryOf }),
  );
  const outcome = await runOperation({
    name: 'EliminarColecciones',
    title: scope === 'all' ? 'Eliminar todas las colecciones' : `Eliminar ${slugs.length} colección(es)`,
    module: MODULE,
    dangerous: true,
    retryOf,
    notifySuccess: false,
    stages: deletionStages({ label: 'Eliminar colecciones en Firestore', expected: 'Colecciones eliminadas y productos actualizados' }),
    ...retry,
    run: async ctx => {
      ctx.start('preview');
      const basePreview = await postCatalogDelete({ action: 'deleteCollections', scope, slugs, productMode: 'unassign', dryRun: true });
      const collectionCount = basePreview?.impact?.collections || 0;
      const affected = basePreview?.impact?.affectedProducts || 0;
      if (!collectionCount) {
        ctx.ok('preview', { received: '0 colecciones a eliminar' });
        toast('No hay colecciones para eliminar.', { type: 'info' });
        ctx.cancel('No había colecciones para eliminar.');
      }
      const mode = chooseCollectionProductMode(affected);
      if (!mode) ctx.cancel('Cancelada por el usuario.');
      const preview = mode.productMode === 'delete'
        ? await postCatalogDelete({ action: 'deleteCollections', scope, slugs, productMode: 'delete', dryRun: true })
        : basePreview;
      ctx.ok('preview', { received: `${collectionCount} colección(es) y ${affected} producto(s) afectados` });

      ctx.start('confirm');
      const phrase = scope === 'all' ? ALL_COLLECTIONS_CONFIRM : COLLECTION_CONFIRM;
      let impact = `${collectionCount} colección(es)`;
      impact += mode.productMode === 'delete'
        ? `\n• ${preview?.impact?.affectedProducts ?? affected} producto(s) serán eliminados globalmente`
        : `\n• ${affected} producto(s) se conservarán y quedarán sin colección`;
      if (!window.confirm(`Operación irreversible:\n• ${impact}\n• Se sincronizará Firebase ↔ Google Sheets ↔ sitio público\n\nLos pedidos históricos y audit log se conservan.`)) ctx.cancel('Cancelada por el usuario.');
      const typed = window.prompt(`Escribí exactamente: ${phrase}`, phrase);
      if (typed === null) { toast('Confirmación cancelada.', { type: 'info' }); ctx.cancel('Cancelada por el usuario.'); }
      if (typed.trim() !== phrase) { toast('Texto de confirmación incorrecto. No se eliminó nada.', { type: 'warning' }); ctx.cancel('Texto de confirmación incorrecto.'); }
      ctx.ok('confirm', { received: 'Frase de confirmación correcta' });

      ctx.start('firestore');
      let result;
      try {
        result = await postCatalogDelete({
          action: 'deleteCollections', scope, slugs, productMode: mode.productMode,
          dryRun: false, confirmation: phrase,
        });
      } catch (error) { uncertainFailure(ctx, error); return; }
      deletedCollections = Number(result.deletedCollections) || 0;
      const { queued } = reportCollectionResult(ctx, result, collectionCount);
      if (!queued) ctx.disableRetry();
    },
  });
  if (outcome.status === GLOBAL_STATUS.GREEN) toast(`${deletedCollections} colección(es) eliminadas globalmente`, { type: 'success' });
  return outcome.status === GLOBAL_STATUS.GREEN;
}

async function executeSingleCollectionDeletion(slug, count, { retryOf = null, preset = null } = {}) {
  const label = String(slug || 'colección');
  let productMode = preset?.productMode || 'unassign';
  let targetCollection = preset?.targetCollection || '';
  if (!preset && Number(count) > 0) {
    const deleteProducts = window.confirm(
      `"${label}" tiene ${count} producto(s).\n\nAceptar = eliminar TAMBIÉN esos productos globalmente.\nCancelar = conservar los productos y elegir a dónde moverlos.`
    );
    if (deleteProducts) productMode = 'delete';
    else {
      const target = window.prompt('Escribí el slug de la colección destino, o dejá vacío para conservar los productos sin colección.', '');
      if (target === null) return false;
      targetCollection = target.trim();
      productMode = targetCollection ? 'reassign' : 'unassign';
    }
  }

  const retry = deletionRetry(
    () => collectionsRemaining('selected', [slug]),
    retryOf => executeSingleCollectionDeletion(slug, count, { retryOf, preset: { productMode, targetCollection } }),
  );
  const outcome = await runOperation({
    name: 'EliminarColeccion',
    title: `Eliminar colección «${label}»`,
    module: MODULE,
    dangerous: true,
    retryOf,
    notifySuccess: false,
    stages: deletionStages({ label: 'Eliminar colección en Firestore', expected: 'Colección eliminada y productos actualizados' }),
    ...retry,
    run: async ctx => {
      ctx.start('preview');
      const preview = await postCatalogDelete({ action: 'deleteCollections', scope: 'selected', slugs: [slug], productMode, targetCollection, dryRun: true });
      const collections = Number(preview?.impact?.collections) || 0;
      const affected = preview?.impact?.affectedProducts || 0;
      ctx.ok('preview', { received: `${collections} colección(es) y ${affected} producto(s) afectados` });
      if (!collections) { toast(`La colección "${label}" ya no existe.`, { type: 'info' }); ctx.cancel('La colección ya no existía.'); }

      ctx.start('confirm');
      if (!window.confirm(`¿Eliminar definitivamente la colección "${label}"?\nProductos afectados: ${affected}.`)) ctx.cancel('Cancelada por el usuario.');
      ctx.ok('confirm', { received: 'Confirmado por el Super Admin' });

      ctx.start('firestore');
      let result;
      try {
        result = await postCatalogDelete({
          action: 'deleteCollections', scope: 'selected', slugs: [slug], productMode, targetCollection,
          dryRun: false, confirmation: COLLECTION_CONFIRM,
        });
      } catch (error) { uncertainFailure(ctx, error); return; }
      const { queued } = reportCollectionResult(ctx, result, collections);
      if (!queued) ctx.disableRetry();
    },
  });
  if (outcome.status === GLOBAL_STATUS.GREEN) toast(`Colección "${label}" eliminada globalmente`, { type: 'success' });
  return outcome.status === GLOBAL_STATUS.GREEN;
}

function injectDangerButton(anchor, id, text, handler, title) {
  if (!anchor || document.getElementById(id)) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.className = 'adm-btn adm-btn-danger adm-btn-sm';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', handler);
  anchor.parentElement?.insertBefore(button, anchor);
}

function installOverrides() {
  if (window.TintinGlobalCatalogDeleteInstalled) return true;
  if (typeof window.bulkDelete !== 'function' || typeof window.prodEliminar !== 'function' ||
      typeof window.bulkDeleteCollections !== 'function' || typeof window.collEliminar !== 'function') return false;
  window.TintinGlobalCatalogDeleteInstalled = true;

  window.prodEliminar = async (docId, name) => {
    try { await executeProductDeletion({ scope: 'selected', productIds: [docId], label: name || docId }); }
    catch (error) { toast(error?.message || 'No se pudo eliminar el producto.'); }
  };
  window.bulkDelete = async (explicitIds) => {
    const ids = Array.isArray(explicitIds) && explicitIds.length
      ? [...new Set(explicitIds.map(id => String(id || '').trim()).filter(Boolean))]
      : selectedProductIds();
    if (!ids.length) { toast('Seleccioná al menos un producto.'); return; }
    try { await executeProductDeletion({ scope: 'selected', productIds: ids }); }
    catch (error) { toast(error?.message || 'No se pudo completar la eliminación masiva.'); }
  };
  window.tintinDeleteAllProducts = () => executeProductDeletion({ scope: 'all' });
  window.bulkDeleteCollections = async (explicitSlugs) => {
    const slugs = Array.isArray(explicitSlugs) && explicitSlugs.length
      ? [...new Set(explicitSlugs.map(slug => String(slug || '').trim()).filter(Boolean))]
      : selectedCollectionSlugs();
    if (!slugs.length) { toast('Seleccioná al menos una colección.'); return; }
    try { await executeCollectionDeletion({ scope: 'selected', slugs }); }
    catch (error) { toast(error?.message || 'No se pudieron eliminar las colecciones.'); }
  };
  window.tintinDeleteAllCollections = () => executeCollectionDeletion({ scope: 'all' });
  window.collEliminar = async (slug, count) => {
    try { await executeSingleCollectionDeletion(slug, count); }
    catch (error) { toast(error?.message || 'No se pudo eliminar la colección.'); }
  };

  // No se agregan accesos de purga global al panel. La política operativa
  // limita toda eliminación masiva a una selección explícita de 30 elementos
  // como máximo, preservando el flujo canónico con Firebase y Sheets. Los IDs
  // legacy 'btn-eliminar-todos-productos' y 'btn-eliminar-todas-colecciones' se
  // conservan solo para que las auditorías detecten cualquier reintroducción.
  return true;
}

function boot() {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installOverrides() || attempts > 80) window.clearInterval(timer);
  }, 125);
}

subscribeAuthState(user => {
  if (isSuperAdmin(user)) boot();
});
