import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminCommit,
  firestoreAdminGet,
  firestoreAdminListAll,
  getGoogleAccessToken,
  parseServiceAccount,
} from './firebase-admin-ligero.js';
import { APPS_SCRIPT_SYNC_URL, SHEETS_TIMEOUT_MS } from './sheets-sync-config.js';
import { syncEngagementToSheets } from './sincronizacion-participacion-sheets.js';

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const MAX_PRODUCTS = 5000;
const QUERY_CHUNK = 30;
const COMMIT_CHUNK = 20;
const PRODUCT_SYNC_CHUNK = 100;

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const docId = document => String(document?.name || '').split('/').pop();
const decoded = document => document ? { id: docId(document), ...decodeFirestoreFields(document.fields || {}) } : null;
const unique = values => [...new Set((values || []).map(value => clean(value, 180)).filter(Boolean))];

function safeId(value, label = 'ID') {
  const result = clean(value, 180);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(result)) throw new Error(`${label} inválido`);
  return result;
}

function firestorePathFromName(name) {
  const marker = '/documents/';
  const value = String(name || '');
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : '';
}

async function commitWrites(env, writes) {
  for (let i = 0; i < writes.length; i += COMMIT_CHUNK) {
    await firestoreAdminCommit(env, writes.slice(i, i + COMMIT_CHUNK));
  }
}

async function runProductIdQuery(env, collectionId, productIds, { allDescendants = false } = {}) {
  const ids = unique(productIds).map(id => safeId(id, 'Producto'));
  if (!ids.length) return [];
  const sa = parseServiceAccount(env);
  const token = await getGoogleAccessToken(env, [FIRESTORE_SCOPE]);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`;
  const documents = new Map();

  for (let i = 0; i < ids.length; i += QUERY_CHUNK) {
    const chunk = ids.slice(i, i + QUERY_CHUNK);
    const value = chunk.length === 1
      ? { stringValue: chunk[0] }
      : { arrayValue: { values: chunk.map(id => ({ stringValue: id })) } };
    const op = chunk.length === 1 ? 'EQUAL' : 'IN';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId, ...(allDescendants ? { allDescendants: true } : {}) }],
          where: { fieldFilter: { field: { fieldPath: 'productId' }, op, value } },
        },
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(`No se pudieron localizar referencias ${collectionId}: ${data?.error?.message || response.status}`);
    }
    const rows = await response.json().catch(() => []);
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row?.document?.name) continue;
      documents.set(row.document.name, row.document);
    }
  }
  return [...documents.values()];
}

async function collectSocialReferences(env, productIds) {
  const [privateReviews, reviewCopies, likes, interactionMappings] = await Promise.all([
    runProductIdQuery(env, 'reviewRecords', productIds),
    runProductIdQuery(env, 'reviews', productIds, { allDescendants: true }),
    runProductIdQuery(env, 'likeRecords', productIds),
    runProductIdQuery(env, 'reviewLikeProducts', productIds, { allDescendants: true }),
  ]);
  return { privateReviews, reviewCopies, likes, interactionMappings };
}

async function syncProductsToSheets(idToken, productIds) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true, batches: 0 };
  let batches = 0;
  for (let i = 0; i < ids.length; i += PRODUCT_SYNC_CHUNK) {
    const response = await fetch(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        action: 'syncProducts',
        sheetName: 'Productos',
        schemaVersion: 2,
        productIds: ids.slice(i, i + PRODUCT_SYNC_CHUNK),
        idToken,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true) {
      throw new Error(data.error || `Sheets Productos respondió ${response.status}`);
    }
    batches += 1;
  }
  return { ok: true, batches };
}

async function syncSocialPurgeToSheets(env, productIds) {
  const ids = unique(productIds);
  if (!ids.length) return { ok: true };
  const ok = await syncEngagementToSheets(env, {
    type: 'productPurge',
    operation: 'delete',
    record: { productIds: ids },
  });
  if (!ok) throw new Error('No se pudo purgar Resenas/Me gusta en Google Sheets.');
  return { ok: true };
}

async function appendAudit(env, actor, action, result) {
  const id = `catalog_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await firestoreAdminCommit(env, [{
    path: `auditLog/${id}`,
    fields: encodeFirestoreFields({
      action,
      targetType: 'catalogo',
      targetId: '',
      targetLabel: '',
      details: JSON.stringify(result).slice(0, 5000),
      bulk: true,
      bulkCount: Number(result.deletedProducts || result.deletedCollections || 0),
      actorEmail: clean(actor?.email, 254),
      actorRole: 'superadmin',
      createdAt: new Date(),
    }),
  }]);
}

async function resolveProducts(env, scope, requestedIds) {
  const documents = await firestoreAdminListAll(env, 'products', MAX_PRODUCTS);
  const all = documents.map(decoded).filter(Boolean);
  if (scope === 'all') return all;
  const wanted = new Set(unique(requestedIds).map(id => safeId(id, 'Producto')));
  return all.filter(product => wanted.has(product.id));
}

async function resolveCollections(env, scope, requestedSlugs) {
  const documents = await firestoreAdminListAll(env, 'collections', MAX_PRODUCTS);
  const all = documents.map(decoded).filter(Boolean);
  if (scope === 'all') return all;
  const wanted = new Set(unique(requestedSlugs).map(slug => safeId(slug, 'Colección')));
  return all.filter(collection => wanted.has(collection.id || collection.slug));
}

async function previewProductDeletion(env, products) {
  const ids = products.map(product => product.id);
  const social = await collectSocialReferences(env, ids);
  return {
    products: ids.length,
    inventoryDocs: ids.length,
    reviewRecords: social.privateReviews.length,
    reviewCopies: social.reviewCopies.length,
    likeRecords: social.likes.length,
    interactionMappings: social.interactionMappings.length,
    reviewStats: ids.length,
    engagementStats: ids.length,
    preservedHistory: ['orders', 'auditLog'],
  };
}

export async function deleteProductsGlobally(env, { scope = 'selected', productIds = [], dryRun = true, idToken = '', actor = null } = {}) {
  const products = await resolveProducts(env, scope, productIds);
  const ids = products.map(product => product.id);
  const impact = await previewProductDeletion(env, products);
  if (dryRun) return { dryRun: true, productIds: ids, impact };
  if (!ids.length) return { dryRun: false, deletedProducts: 0, impact, sheets: { products: true, social: true } };

  const social = await collectSocialReferences(env, ids);
  const deletePaths = new Set();
  social.privateReviews.forEach(document => deletePaths.add(firestorePathFromName(document.name)));
  social.reviewCopies.forEach(document => deletePaths.add(firestorePathFromName(document.name)));
  social.likes.forEach(document => deletePaths.add(firestorePathFromName(document.name)));
  social.interactionMappings.forEach(document => deletePaths.add(firestorePathFromName(document.name)));
  ids.forEach(id => {
    deletePaths.add(`productInventory/${id}`);
    deletePaths.add(`productReviewStats/${id}`);
    deletePaths.add(`productEngagementStats/${id}`);
    deletePaths.add(`products/${id}`);
  });
  await commitWrites(env, [...deletePaths].filter(Boolean).map(path => ({ path, delete: true })));

  const result = {
    deletedProducts: ids.length,
    deletedFirestoreDocuments: deletePaths.size,
    socialPurged: {
      reviewRecords: social.privateReviews.length,
      reviewCopies: social.reviewCopies.length,
      likes: social.likes.length,
      interactionMappings: social.interactionMappings.length,
    },
    preservedHistory: ['orders', 'auditLog'],
  };

  let productsSheets = false;
  let socialSheets = false;
  const errors = [];
  try { await syncProductsToSheets(idToken, ids); productsSheets = true; }
  catch (error) { errors.push(clean(error?.message, 500)); }
  try { await syncSocialPurgeToSheets(env, ids); socialSheets = true; }
  catch (error) { errors.push(clean(error?.message, 500)); }
  result.sheets = { products: productsSheets, social: socialSheets };
  result.partial = errors.length > 0;
  result.errors = errors;
  await appendAudit(env, actor, 'eliminar_producto_global', result);
  return result;
}

export async function deleteCollectionsGlobally(env, {
  scope = 'selected', slugs = [], productMode = 'unassign', targetCollection = '', dryRun = true,
  idToken = '', actor = null,
} = {}) {
  const collections = await resolveCollections(env, scope, slugs);
  const selectedSlugs = unique(collections.map(collection => collection.id || collection.slug));
  const selectedSet = new Set(selectedSlugs);
  const allProducts = (await firestoreAdminListAll(env, 'products', MAX_PRODUCTS)).map(decoded).filter(Boolean);
  const affectedProducts = allProducts.filter(product => selectedSet.has(clean(product.category)) || selectedSet.has(clean(product.collection)));
  const affectedIds = affectedProducts.map(product => product.id);

  const target = clean(targetCollection);
  if (productMode === 'reassign') {
    if (!target || selectedSet.has(target)) throw new Error('Elegí una colección destino distinta de las que se van a eliminar.');
    if (!await firestoreAdminGet(env, `collections/${safeId(target, 'Colección destino')}`)) throw new Error('La colección destino no existe.');
  }
  if (!['unassign', 'reassign', 'delete'].includes(productMode)) throw new Error('Modo de productos inválido.');

  const impact = {
    collections: selectedSlugs.length,
    affectedProducts: affectedIds.length,
    productMode,
    targetCollection: target,
    preservedHistory: ['orders', 'auditLog'],
  };
  if (productMode === 'delete') impact.productDeletion = await previewProductDeletion(env, affectedProducts);
  if (dryRun) return { dryRun: true, slugs: selectedSlugs, productIds: affectedIds, impact };

  let productDeleteResult = null;
  if (productMode === 'delete' && affectedIds.length) {
    productDeleteResult = await deleteProductsGlobally(env, {
      scope: 'selected', productIds: affectedIds, dryRun: false, idToken, actor,
    });
  } else if (affectedIds.length) {
    const nowFields = encodeFirestoreFields({
      category: productMode === 'reassign' ? target : '',
      collection: productMode === 'reassign' ? target : '',
      updatedAt: new Date(),
    });
    await commitWrites(env, affectedIds.map(id => ({
      path: `products/${id}`,
      fields: nowFields,
      mergeFields: ['category', 'collection', 'updatedAt'],
    })));
  }

  await commitWrites(env, selectedSlugs.map(slug => ({ path: `collections/${safeId(slug, 'Colección')}`, delete: true })));
  let productsSheets = productDeleteResult?.sheets?.products === true;
  const errors = [...(productDeleteResult?.errors || [])];
  if (productMode !== 'delete' && affectedIds.length) {
    try { await syncProductsToSheets(idToken, affectedIds); productsSheets = true; }
    catch (error) { errors.push(clean(error?.message, 500)); }
  }

  const result = {
    deletedCollections: selectedSlugs.length,
    affectedProducts: affectedIds.length,
    productMode,
    targetCollection: target,
    deletedProducts: productDeleteResult?.deletedProducts || 0,
    productPurge: productDeleteResult,
    sheets: { products: productsSheets || !affectedIds.length, social: productDeleteResult?.sheets?.social ?? true },
    preservedHistory: ['orders', 'auditLog'],
    partial: errors.length > 0,
    errors,
  };
  await appendAudit(env, actor, 'eliminar_coleccion_global', result);
  return result;
}
