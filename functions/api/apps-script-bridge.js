import {
  corsHeaders,
  jsonResponse,
  originIsAllowed,
  preflightResponse
} from '../../cloudflare/seguridad-cloudinary.js';
import { verifyFirebaseIdToken } from '../../cloudflare/firebase-id-token.js';
import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import { firestoreAdminBatchCommit } from '../../cloudflare/firestore-admin-batch.js';
import { fetchAppsScript } from '../../cloudflare/apps-script-fetch.js';
import { syncOrderToSheetsBestEffort } from '../../cloudflare/order-sheets-sync.js';

// Apps Script sigue ejecutando únicamente la transacción privilegiada heredada
// de creación de pedidos y las rutas de correo antiguas que aún puedan invocarse
// durante la transición. El navegador nunca debe conectarse directamente a este
// deployment: todas las solicitudes pasan primero por Cloudflare.
const APPS_SCRIPT_ORDER_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyh9I5aPp9d3lMSnYRNfrHcSCCobCoDOif9CqtXmMe4FgwSjzlKf4kjQZqvKDRmEY6S/exec';
const MAX_BODY_BYTES = 96 * 1024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{6,220}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const ALLOWED_ACTIONS = new Set([
  'createOrder',
  'sendOrderEmail',
  'resendOrderEmail',
  'sendTestCustomerEmail',
  'sendPromoEmail',
  'sendBulkPromoEmail'
]);

function clean(value, maxLength = 500) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function authFailure(error) {
  const status = Number(error?.status) || 401;
  if (status === 403 || error?.code === 'auth/email-not-verified') {
    return { status: 403, error: 'email_not_verified' };
  }
  if (status >= 500) {
    return { status, error: 'token_verify_failed' };
  }
  return { status: 401, error: 'invalid_id_token' };
}

function versionPrecondition(document) {
  return document?.updateTime ? { updateTime: document.updateTime } : { exists: true };
}

function firstValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null && clean(value)) return value;
  }
  return '';
}

function profileHasName(profile = {}) {
  const first = clean(firstValue(profile, ['firstName', 'first_name', 'nombre']), 80);
  const last = clean(firstValue(profile, ['lastName', 'last_name', 'apellido']), 80);
  if (first && last) return true;
  const full = clean(firstValue(profile, ['name', 'fullName', 'nombreCompleto']), 160);
  return full.split(/\s+/).filter(Boolean).length >= 2;
}

function profileHasLocation(profile = {}) {
  const candidates = [
    profile.savedLocation,
    profile.location,
    profile.mapLocation,
    profile.deliveryLocation,
    profile.defaultLocation,
    profile.coordinates,
    profile.coords,
  ].filter(value => value && typeof value === 'object');

  candidates.push({
    lat: profile.addressLat ?? profile.latitude,
    lng: profile.addressLng ?? profile.longitude ?? profile.longitud,
    name: profile.locationName ?? profile.addressName ?? profile.nombreUbicacion,
  });

  return candidates.some(location => {
    const geoPoint = location?.geoPoint || location?.geopoint || location?.point || {};
    const coordinates = location?.coordinates || location?.coords || {};
    const lat = Number(location?.lat ?? location?.latitude ?? location?.latitud ?? coordinates?.lat ?? coordinates?.latitude ?? geoPoint?.latitude);
    const lng = Number(location?.lng ?? location?.longitude ?? coordinates?.lng ?? coordinates?.longitude ?? geoPoint?.longitude);
    const name = clean(location?.name ?? location?.locationName ?? location?.addressName ?? location?.label ?? location?.title, 160);
    return name && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  });
}

function profileHasPersistedCompletion(profile = {}) {
  return profile.onboardingCompleted === true ||
    profile.profileCompleted === true ||
    Boolean(
      profile.onboardingCompletedAt ||
      profile.profileCompletedAt ||
      profile.welcomeTutorialCompletedAt ||
      profile.welcomeTutorialSeen
    );
}

/**
 * Misma semántica comercial que el cliente: `active` y las marcas históricas
 * son confirmaciones persistidas. Para perfiles previos al marcador canónico,
 * se acepta la completitud real de los campos obligatorios para no bloquear a
 * clientas existentes que ya pasaron por el alta anterior.
 */
export function isPurchaseEligibleProfile(profile = {}) {
  if (clean(profile.profileStatus, 40).toLowerCase() === 'active') return true;
  if (profileHasPersistedCompletion(profile)) return true;

  const phone = clean(firstValue(profile, [
    'phone', 'phoneNumber', 'whatsapp', 'whatsappNumber', 'telefono', 'celular'
  ]), 60);
  const username = clean(firstValue(profile, [
    'username', 'userName', 'nombreUsuario', 'nombre_usuario'
  ]), 40).toLowerCase();
  const dob = firstValue(profile, [
    'dob', 'birthDate', 'dateOfBirth', 'fechaNacimiento', 'fecha_nacimiento'
  ]);

  return profileHasName(profile) &&
    Boolean(phone) &&
    USERNAME_PATTERN.test(username) &&
    Boolean(dob) &&
    profileHasLocation(profile);
}

async function assertPurchaseEligibleAccount(env, authenticatedUser) {
  const uid = clean(authenticatedUser?.uid, 128);
  if (!uid) {
    throw Object.assign(new Error('La sesión autenticada no contiene un UID válido.'), {
      status: 401,
      code: 'invalid_id_token',
    });
  }

  const userDocument = await firestoreAdminGet(env, `users/${encodeURIComponent(uid)}`);
  if (!userDocument) {
    throw Object.assign(new Error('La cuenta no tiene un perfil de compra en Firestore.'), {
      status: 409,
      code: 'profile_missing',
    });
  }

  const profile = decodeFirestoreFields(userDocument.fields || {});
  if (profile.blocked === true || clean(profile.profileStatus, 40).toLowerCase() === 'deleted') {
    throw Object.assign(new Error('La cuenta no está habilitada para comprar.'), {
      status: 403,
      code: 'account_blocked',
    });
  }
  if (!isPurchaseEligibleProfile(profile)) {
    throw Object.assign(new Error('El perfil todavía no está completo.'), {
      status: 409,
      code: 'profile_incomplete',
    });
  }
  return profile;
}

async function enforceCanonicalOrderIdentity(env, orderId, authenticatedUser) {
  const safeOrderId = clean(orderId, 220);
  const uid = clean(authenticatedUser?.uid, 128);
  if (!ORDER_ID_PATTERN.test(safeOrderId) || !uid) {
    throw Object.assign(new Error('El pedido confirmado no devolvió una identidad válida.'), {
      status: 502,
      code: 'order_identity_invalid',
    });
  }

  const customerId = `CUS_${uid}`;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const orderDocument = await firestoreAdminGet(env, `orders/${safeOrderId}`);
    if (!orderDocument) {
      throw Object.assign(new Error('El pedido confirmado no existe en Firestore.'), {
        status: 502,
        code: 'order_missing_after_commit',
      });
    }

    const order = decodeFirestoreFields(orderDocument.fields || {});
    if (clean(order.userId, 128) !== uid) {
      throw Object.assign(new Error('La identidad del pedido no coincide con la sesión autenticada.'), {
        status: 502,
        code: 'order_identity_mismatch',
      });
    }

    const existingCustomerId = clean(order.customerId, 180);
    if (existingCustomerId === customerId) {
      return { customerId, repaired: false, order };
    }
    if (existingCustomerId && existingCustomerId !== customerId) {
      throw Object.assign(new Error('El pedido contiene un Customer ID incompatible.'), {
        status: 502,
        code: 'customer_identity_mismatch',
      });
    }

    try {
      await firestoreAdminBatchCommit(env, [{
        path: `orders/${safeOrderId}`,
        fields: encodeFirestoreFields({ customerId }),
        mergeFields: ['customerId'],
        currentDocument: versionPrecondition(orderDocument),
      }]);
      return { customerId, repaired: true, order: { ...order, customerId } };
    } catch (error) {
      if (Number(error?.status) === 409 && attempt < 2) continue;
      throw error;
    }
  }

  throw Object.assign(new Error('No se pudo fijar la identidad canónica del pedido.'), {
    status: 502,
    code: 'order_identity_commit_failed',
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const requestUrl = request.url;
  const origin = request.headers.get('origin') || '';

  if (!originIsAllowed(origin, requestUrl)) {
    return jsonResponse({ ok: false, error: 'origin_not_allowed' }, 403, origin, requestUrl);
  }
  if (request.method === 'OPTIONS') {
    return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  }
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, origin, requestUrl);
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, origin, requestUrl);
  }

  try {
    const rawBody = await request.text();
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, error: 'payload_too_large' }, 413, origin, requestUrl);
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400, origin, requestUrl);
    }

    const action = clean(payload?.action, 60);
    const idToken = clean(payload?.idToken, 5000);
    if (!ALLOWED_ACTIONS.has(action)) {
      return jsonResponse({ ok: false, error: 'action_not_allowed' }, 400, origin, requestUrl);
    }
    if (!idToken) {
      return jsonResponse({ ok: false, error: 'missing_id_token' }, 401, origin, requestUrl);
    }

    // La creación de un pedido es una operación comercial: Cloudflare valida
    // el mismo token que Apps Script volverá a comprobar. Ningún userId,
    // customerId ni userEmail enviado por el navegador atraviesa esta frontera;
    // Apps Script deriva esos datos del UID/correo autenticados. Además se
    // valida el perfil canónico antes de tocar stock: una falla de lectura o
    // un perfil incompleto bloquea la compra, pero NUNCA cierra la sesión.
    const forwardedPayload = { ...payload };
    let authenticatedUser = null;
    if (action === 'createOrder') {
      try {
        authenticatedUser = await verifyFirebaseIdToken(idToken);
      } catch (error) {
        const failure = authFailure(error);
        return jsonResponse({ ok: false, error: failure.error }, failure.status, origin, requestUrl);
      }
      try {
        await assertPurchaseEligibleAccount(env, authenticatedUser);
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: clean(error?.code, 120) || 'profile_validation_failed'
        }, Number(error?.status) || 409, origin, requestUrl);
      }
      delete forwardedPayload.userId;
      delete forwardedPayload.customerId;
      delete forwardedPayload.userEmail;
      forwardedPayload.idToken = idToken;
    }

    const upstream = await fetchAppsScript(APPS_SCRIPT_ORDER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(forwardedPayload),
      redirect: 'follow'
    });
    const body = await upstream.text();
    const headers = corsHeaders(origin, requestUrl);
    headers['content-type'] = 'application/json; charset=utf-8';
    headers['x-tintin-upstream'] = 'apps-script-bridge';

    if (action === 'createOrder' && upstream.ok) {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch {}
      if (parsed?.ok === true) {
        const identity = await enforceCanonicalOrderIdentity(env, parsed.orderId, authenticatedUser);
        const sheetsSyncPromise = syncOrderToSheetsBestEffort(env, {
          orderId: parsed.orderId,
          order: identity.order,
        });
        context.waitUntil?.(sheetsSyncPromise);
        parsed.customerId = identity.customerId;
        const sheetsSync = { ok: true, deferred: true };
        parsed.sheetsSync = sheetsSync;
        if (parsed.order && typeof parsed.order === 'object') {
          parsed.order.customerId = identity.customerId;
        }
        return new Response(JSON.stringify(parsed), {
          status: upstream.status,
          headers
        });
      }
    }

    return new Response(body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    console.error('[apps-script-bridge]', clean(error?.code, 120), clean(error?.message, 200));
    return jsonResponse({
      ok: false,
      error: clean(error?.code, 120) || 'upstream_unavailable'
    }, Number(error?.status) || 502, origin, requestUrl);
  }
}
