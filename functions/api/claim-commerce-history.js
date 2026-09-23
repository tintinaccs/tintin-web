import { jsonResponse, originIsAllowed, preflightResponse, requireFirebaseUser, statusFromError } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminCommit, firestoreAdminFindFirstByFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';

function clean(value, max = 254) { return String(value == null ? '' : value).trim().slice(0, max); }
async function emailHistoryHash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clean(value).toLowerCase()));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, request.url);
  try {
    const actor = await requireFirebaseUser(request);
    const email = clean(actor.email).toLowerCase();
    if (!email) throw Object.assign(new Error('Correo no verificable.'), { status: 400 });
    const profilePath = `users/${encodeURIComponent(actor.uid)}`;
    const profileDoc = await firestoreAdminGet(env, profilePath);
    const profile = decodeFirestoreFields(profileDoc?.fields || {});
    if (!profileDoc || clean(profile.email).toLowerCase() !== email || profile.deleted === true) throw Object.assign(new Error('El perfil nuevo todavía no está listo.'), { status: 409 });
    if (profile.commerceHistoryClaimed === true) return jsonResponse({ ok: true, claimed: false, alreadyClaimed: true }, 200, origin, request.url);
    const sourceDoc = await firestoreAdminFindFirstByFields(env, 'users', ['deletedEmailHash'], await emailHistoryHash(email));
    const source = decodeFirestoreFields(sourceDoc?.fields || {});
    if (!sourceDoc || source.deleted !== true || source.profileStatus !== 'deleted') {
      await firestoreAdminCommit(env, [{ path: profilePath, fields: encodeFirestoreFields({ commerceHistoryClaimed: true, updatedAt: new Date() }), mergeFields: ['commerceHistoryClaimed', 'updatedAt'] }]);
      return jsonResponse({ ok: true, claimed: false }, 200, origin, request.url);
    }
    if (source.commerceHistoryClaimedByUid && source.commerceHistoryClaimedByUid !== actor.uid) throw Object.assign(new Error('El historial ya fue recuperado.'), { status: 409 });
    const sourceUid = String(sourceDoc.name || '').split('/').pop();
    const now = new Date();
    const metrics = {
      customerId: source.customerId || profile.customerId, purchaseCount: Number(source.purchaseCount || 0), orderCount: Number(source.orderCount || 0), totalOrders: Number(source.totalOrders || 0), totalSpent: Number(source.totalSpent || 0), completedOrders: Number(source.completedOrders || 0), pendingOrders: Number(source.pendingOrders || 0), cancelledOrders: Number(source.cancelledOrders || 0), lastOrderId: source.lastOrderId || '', lastPurchaseOrderId: source.lastPurchaseOrderId || '', commerceHistoryClaimed: true, commerceHistorySourceUid: sourceUid, updatedAt: now,
    };
    await firestoreAdminCommit(env, [
      { path: profilePath, fields: encodeFirestoreFields(metrics), mergeFields: Object.keys(metrics) },
      { path: `users/${encodeURIComponent(sourceUid)}`, fields: encodeFirestoreFields({ commerceHistoryClaimedByUid: actor.uid, commerceHistoryClaimedAt: now }), mergeFields: ['commerceHistoryClaimedByUid', 'commerceHistoryClaimedAt'] },
    ]);
    return jsonResponse({ ok: true, claimed: true }, 200, origin, request.url);
  } catch (error) {
    console.error('[claim-commerce-history]', error?.message || error);
    return jsonResponse({ ok: false, error: 'No se pudo recuperar el historial comercial.' }, statusFromError(error, 500), origin, request.url);
  }
}
