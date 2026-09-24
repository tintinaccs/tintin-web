import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  deleteCollectionsGlobally,
  deleteProductsGlobally,
} from '../../cloudflare/borrado-global-catalogo.js';
import {
  preflightProductsSheet,
  retryPendingCatalogSheets,
} from '../../cloudflare/resiliencia-sync-catalogo.js';

const MAX_BODY_BYTES = 96 * 1024;
const PRODUCT_CONFIRM = 'ELIMINAR DEFINITIVAMENTE';
const ALL_PRODUCTS_CONFIRM = 'ELIMINAR TODOS LOS PRODUCTOS';
const COLLECTION_CONFIRM = 'ELIMINAR COLECCIONES DEFINITIVAMENTE';
const ALL_COLLECTIONS_CONFIRM = 'ELIMINAR TODAS LAS COLECCIONES';

function tokenFromRequest(request) {
  const match = /^Bearer\s+(.+)$/i.exec(String(request.headers.get('authorization') || ''));
  return match ? match[1].trim() : '';
}

function safeMessage(error) {
  return String(error?.message || 'No se pudo completar la operación.').replace(/[<>\u0000-\u001f]/g, ' ').slice(0, 400);
}

function validConfirmation(action, scope, confirmation, dryRun, env) {
  if (dryRun || action === 'retryPending') return true;
  const exact = String(confirmation || '').trim();
  if (action === 'deleteProducts') {
    const secret = String(env?.CATALOG_DELETE_PASSWORD || '').trim();
    if (!secret) throw new Error('La contraseña secreta de borrado no está configurada en Cloudflare.');
    return exact === secret;
  }
  if (action === 'deleteCollections') return exact === (scope === 'all' ? ALL_COLLECTIONS_CONFIRM : COLLECTION_CONFIRM);
  return false;
}

function productIdsFromPreview(preview) {
  return Array.isArray(preview?.productIds) ? preview.productIds : [];
}

async function runCatalogAction(action, env, body, scope, dryRun, idToken, actorContext) {
  if (action === 'deleteProducts') {
    return deleteProductsGlobally(env, {
      scope,
      productIds: Array.isArray(body.productIds) ? body.productIds : [],
      dryRun,
      idToken,
      actor: actorContext,
    });
  }
  return deleteCollectionsGlobally(env, {
    scope,
    slugs: Array.isArray(body.slugs) ? body.slugs : [],
    productMode: String(body.productMode || 'unassign'),
    targetCollection: String(body.targetCollection || ''),
    dryRun,
    idToken,
    actor: actorContext,
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);

  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error('Solicitud inválida.');
    const body = JSON.parse(raw);
    const action = String(body.action || '');
    const scope = body.scope === 'all' ? 'all' : 'selected';
    const dryRun = body.dryRun !== false;
    if (!['deleteProducts', 'deleteCollections', 'retryPending'].includes(action)) throw new Error('Acción de catálogo inválida.');
    if (!validConfirmation(action, scope, body.confirmation, dryRun, env)) throw new Error('Contraseña secreta inválida.');

    const idToken = tokenFromRequest(request);
    const actorContext = { uid: actor.uid, email: actor.email, role: 'superadmin' };

    if (action === 'retryPending') {
      const result = await retryPendingCatalogSheets(env, idToken);
      return jsonResponse({ ok: result.remaining === 0, partial: result.remaining > 0, result }, result.remaining > 0 ? 207 : 200, origin, requestUrl);
    }

    if (dryRun) {
      const result = await runCatalogAction(action, env, body, scope, true, idToken, actorContext);
      return jsonResponse({ ok: true, partial: false, result }, 200, origin, requestUrl);
    }

    // El servidor repite su propio preview aunque la UI ya lo haya mostrado.
    // Así obtiene los IDs canónicos justo antes de la destrucción y no confía
    // en una selección potencialmente vieja del navegador.
    const serverPreview = await runCatalogAction(action, env, body, scope, true, idToken, actorContext);
    const affectedProductIds = productIdsFromPreview(serverPreview);

    // El preflight continúa comprobando Apps Script, permisos y spreadsheet
    // antes del borrado. Firestore sigue siendo la fuente canónica: una
    // caída temporal del espejo no puede impedir una eliminación autorizada.
    // Se informa en el resultado para que el cierre persistente la recupere.
    let preflightError = '';
    try {
      await preflightProductsSheet(env, affectedProductIds);
    } catch (error) {
      preflightError = safeMessage(error);
      console.warn('[admin-catalog-delete] preflight de Sheets pendiente:', preflightError);
    }

    const result = await runCatalogAction(action, env, body, scope, false, idToken, actorContext);

    // El preflight es una comprobación preventiva, no la autoridad del estado
    // final. Si el cierre posterior confirmó Productos en Sheets, una falla
    // transitoria del preflight ya quedó recuperada y no debe convertir una
    // eliminación correcta en HTTP 207 / "sincronización pendiente".
    const productsSheetConfirmed = result?.sheets?.products === true;
    if (preflightError && !productsSheetConfirmed) {
      result.partial = true;
      result.errors = [...(Array.isArray(result.errors) ? result.errors : []), `Preflight de Google Sheets pendiente: ${preflightError}`];
      result.sheets = { ...(result.sheets || {}), products: false };
      result.pendingSheetSync = true;
    } else if (productsSheetConfirmed) {
      result.pendingSheetSync = false;
      if (preflightError) result.preflightRecovered = true;
    }

    const status = result?.partial ? 207 : 200;
    return jsonResponse({ ok: result?.partial !== true, partial: result?.partial === true, result }, status, origin, requestUrl);
  } catch (error) {
    console.error('[admin-catalog-delete]', error?.message || error);
    return jsonResponse({ ok: false, error: safeMessage(error) }, statusFromError(error, 400), origin, requestUrl);
  }
}
