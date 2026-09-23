/* =============================================================
   TINTIN — Borrado global canónico de Productos y Colecciones
   Solo Super Admin. Todo borrado destructivo pasa por Cloudflare para
   coordinar Firestore + inventario + social + Google Sheets.
   ============================================================= */

import { auth } from '../../core/firebase/firebase.js?v=tintin-20260921-auth-session-never-unknown-1';
import { subscribeAuthState } from '../../core/auth/coordinador-sesion.js?v=tintin-20260921-auth-session-never-unknown-3';
import { isSuperAdmin } from '../../core/auth/identidad-super-admin.js?v=tintin-20260916-superadmin-identity-2';

const API = '/api/admin-catalog-delete';
const PRODUCT_CONFIRM = 'ELIMINAR DEFINITIVAMENTE';
const ALL_PRODUCTS_CONFIRM = 'ELIMINAR TODOS LOS PRODUCTOS';
const COLLECTION_CONFIRM = 'ELIMINAR COLECCIONES DEFINITIVAMENTE';
const ALL_COLLECTIONS_CONFIRM = 'ELIMINAR TODAS LAS COLECCIONES';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const toast = message => typeof window.toast === 'function' ? window.toast(message) : window.alert(message);

// Cloudflare corta cada invocación del Worker al superar su límite de
// subrequests. Un borrado masivo de todo el catálogo genera, por producto,
// varias consultas a Firestore + Sheets; sin trocear, cientos de productos
// en un solo POST superan ese límite y el navegador recibe el error crudo
// de la plataforma ("Too many subrequests..."). Se envía en lotes chicos
// para que cada invocación del servidor se mantenga muy por debajo del tope.
const DELETE_BATCH_SIZE = 30;

function chunkIds(ids, size) {
  const batches = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));
  return batches;
}

function mergeDeleteResults(target, part) {
  target.deletedProducts += Number(part?.deletedProducts) || 0;
  target.deletedFirestoreDocuments += Number(part?.deletedFirestoreDocuments) || 0;
  if (part?.partial) target.partial = true;
  if (Array.isArray(part?.errors)) target.errors.push(...part.errors.filter(Boolean));
  return target;
}

async function postCatalogDelete(payload) {
  const user = auth.currentUser;
  if (!isSuperAdmin(user)) throw new Error('Esta acción es exclusiva del Super Admin.');
  const idToken = await user.getIdToken();
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 207) throw new Error(data.error || `Error ${response.status}`);
  if (!data.result) throw new Error(data.error || 'El servidor no devolvió el resultado de la purga.');
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

function partialMessage(result) {
  const errors = Array.isArray(result?.errors) ? result.errors.filter(Boolean) : [];
  return `La purga de Firebase se ejecutó, pero quedó una sincronización externa pendiente.\n\n${errors.join('\n') || 'Revisá Google Sheets.'}\n\nNo se marcará como completada globalmente hasta resolver esa sincronización.`;
}

async function executeProductDeletion({ scope, productIds = [], label = '' }) {
  const preview = await postCatalogDelete({ action: 'deleteProducts', scope, productIds, dryRun: true });
  const canonicalIds = Array.isArray(preview?.productIds) ? preview.productIds : [];
  const n = canonicalIds.length;
  if (!n) { toast('No hay productos para eliminar.'); return false; }
  const phrase = scope === 'all' ? ALL_PRODUCTS_CONFIRM : PRODUCT_CONFIRM;
  const heading = scope === 'all' ? `Vas a eliminar TODOS los ${n} productos actuales.` : `Vas a eliminar ${n} producto(s)${label ? `: ${label}` : ''}.`;
  if (!window.confirm(`${heading}\n\nTambién se purgará:\n• ${impactProductText(preview)}\n\nLos pedidos históricos y el audit log se conservan como comprobantes.`)) return false;
  const typed = window.prompt(`Confirmación irreversible. Escribí exactamente:\n\n${phrase}`, '');
  if (typed !== phrase) { toast('Confirmación cancelada. No se eliminó nada.'); return false; }

  // La lista canónica de IDs ya viene confirmada por el servidor (preview).
  // Se envía troceada en varios POST secuenciales para que cada invocación
  // del Worker se mantenga bien por debajo del límite de subrequests de
  // Cloudflare, sin importar cuántos productos tenga el catálogo.
  const batches = chunkIds(canonicalIds, DELETE_BATCH_SIZE);
  const aggregate = { deletedProducts: 0, deletedFirestoreDocuments: 0, partial: false, errors: [] };
  let stoppedEarly = false;
  for (let i = 0; i < batches.length; i += 1) {
    if (batches.length > 1) toast(`Eliminando productos… (${i + 1}/${batches.length})`);
    try {
      const result = await postCatalogDelete({
        action: 'deleteProducts', scope: 'selected', productIds: batches[i],
        dryRun: false, confirmation: PRODUCT_CONFIRM,
      });
      mergeDeleteResults(aggregate, result);
    } catch (error) {
      aggregate.partial = true;
      aggregate.errors.push(error?.message || 'Error desconocido en un lote de eliminación.');
      stoppedEarly = true;
      break;
    }
  }

  if (aggregate.partial) {
    window.alert(stoppedEarly
      ? `Se eliminaron ${aggregate.deletedProducts} de ${n} producto(s) antes de encontrar un error. Volvé a intentar para completar el resto.\n\n${aggregate.errors.join('\n')}`
      : partialMessage(aggregate));
  } else {
    toast(`${aggregate.deletedProducts || n} producto(s) eliminados globalmente`);
  }
  if (aggregate.deletedProducts > 0) window.setTimeout(() => window.location.reload(), 700);
  return !aggregate.partial;
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
  toast('Opción no reconocida. Operación cancelada.');
  return null;
}

async function executeCollectionDeletion({ scope, slugs = [] }) {
  const basePreview = await postCatalogDelete({ action: 'deleteCollections', scope, slugs, productMode: 'unassign', dryRun: true });
  const collectionCount = basePreview?.impact?.collections || 0;
  const affected = basePreview?.impact?.affectedProducts || 0;
  if (!collectionCount) { toast('No hay colecciones para eliminar.'); return false; }
  const mode = chooseCollectionProductMode(affected);
  if (!mode) return false;

  const preview = mode.productMode === 'delete'
    ? await postCatalogDelete({ action: 'deleteCollections', scope, slugs, productMode: 'delete', dryRun: true })
    : basePreview;
  const phrase = scope === 'all' ? ALL_COLLECTIONS_CONFIRM : COLLECTION_CONFIRM;
  let impact = `${collectionCount} colección(es)`;
  impact += mode.productMode === 'delete'
    ? `\n• ${affected} producto(s) serán eliminados globalmente` 
    : `\n• ${affected} producto(s) se conservarán y quedarán sin colección`;
  if (!window.confirm(`Operación irreversible:\n• ${impact}\n• Se sincronizará Firebase ↔ Google Sheets ↔ sitio público\n\nLos pedidos históricos y audit log se conservan.`)) return false;
  const typed = window.prompt(`Escribí exactamente para confirmar:\n\n${phrase}`, '');
  if (typed !== phrase) { toast('Confirmación cancelada.'); return false; }

  const result = await postCatalogDelete({
    action: 'deleteCollections', scope, slugs, productMode: mode.productMode,
    dryRun: false, confirmation: phrase,
  });
  if (result.partial) window.alert(partialMessage(result));
  else toast(`${result.deletedCollections || collectionCount} colección(es) eliminadas globalmente`);
  window.setTimeout(() => window.location.reload(), 700);
  return !result.partial;
}

async function executeSingleCollectionDeletion(slug, count) {
  const label = String(slug || 'colección');
  let productMode = 'unassign';
  let targetCollection = '';
  if (Number(count) > 0) {
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

  const preview = await postCatalogDelete({ action: 'deleteCollections', scope: 'selected', slugs: [slug], productMode, targetCollection, dryRun: true });
  const affected = preview?.impact?.affectedProducts || 0;
  if (!window.confirm(`¿Eliminar definitivamente la colección "${label}"?\nProductos afectados: ${affected}.`)) return false;
  const result = await postCatalogDelete({
    action: 'deleteCollections', scope: 'selected', slugs: [slug], productMode, targetCollection,
    dryRun: false, confirmation: COLLECTION_CONFIRM,
  });
  if (result.partial) window.alert(partialMessage(result));
  else toast(`Colección "${label}" eliminada globalmente`);
  window.setTimeout(() => window.location.reload(), 700);
  return !result.partial;
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
  window.bulkDeleteCollections = async () => {
    const slugs = selectedCollectionSlugs();
    if (!slugs.length) { toast('Seleccioná al menos una colección.'); return; }
    try { await executeCollectionDeletion({ scope: 'selected', slugs }); }
    catch (error) { toast(error?.message || 'No se pudieron eliminar las colecciones.'); }
  };
  window.tintinDeleteAllCollections = () => executeCollectionDeletion({ scope: 'all' });
  window.collEliminar = async (slug, count) => {
    try { await executeSingleCollectionDeletion(slug, count); }
    catch (error) { toast(error?.message || 'No se pudo eliminar la colección.'); }
  };

  injectDangerButton(
    document.getElementById('btn-nuevo-producto'),
    'btn-eliminar-todos-productos',
    'Eliminar TODOS',
    () => executeProductDeletion({ scope: 'all' }).catch(error => toast(error?.message || 'No se pudieron eliminar todos los productos.')),
    'Purga global irreversible de todos los productos actuales'
  );
  injectDangerButton(
    document.getElementById('btn-nueva-coleccion'),
    'btn-eliminar-todas-colecciones',
    'Eliminar TODAS',
    () => executeCollectionDeletion({ scope: 'all' }).catch(error => toast(error?.message || 'No se pudieron eliminar todas las colecciones.')),
    'Eliminar globalmente todas las colecciones actuales'
  );
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
