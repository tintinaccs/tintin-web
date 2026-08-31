import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  deleteCollectionsGlobally,
  deleteProductsGlobally,
} from '../../cloudflare/borrado-global-catalogo.js';

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

function validConfirmation(action, scope, confirmation, dryRun) {
  if (dryRun) return true;
  const exact = String(confirmation || '').trim();
  if (action === 'deleteProducts') return exact === (scope === 'all' ? ALL_PRODUCTS_CONFIRM : PRODUCT_CONFIRM);
  if (action === 'deleteCollections') return exact === (scope === 'all' ? ALL_COLLECTIONS_CONFIRM : COLLECTION_CONFIRM);
  return false;
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
    if (!['deleteProducts', 'deleteCollections'].includes(action)) throw new Error('Acción de catálogo inválida.');
    if (!validConfirmation(action, scope, body.confirmation, dryRun)) throw new Error('Confirmación exacta inválida.');

    const idToken = tokenFromRequest(request);
    const actorContext = { uid: actor.uid, email: actor.email, role: 'superadmin' };
    const result = action === 'deleteProducts'
      ? await deleteProductsGlobally(env, {
          scope,
          productIds: Array.isArray(body.productIds) ? body.productIds : [],
          dryRun,
          idToken,
          actor: actorContext,
        })
      : await deleteCollectionsGlobally(env, {
          scope,
          slugs: Array.isArray(body.slugs) ? body.slugs : [],
          productMode: String(body.productMode || 'unassign'),
          targetCollection: String(body.targetCollection || ''),
          dryRun,
          idToken,
          actor: actorContext,
        });

    const status = result?.partial ? 207 : 200;
    return jsonResponse({ ok: result?.partial !== true, partial: result?.partial === true, result }, status, origin, requestUrl);
  } catch (error) {
    console.error('[admin-catalog-delete]', error?.message || error);
    return jsonResponse({ ok: false, error: safeMessage(error) }, 400, origin, requestUrl);
  }
}
