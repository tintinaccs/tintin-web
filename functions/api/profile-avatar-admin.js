import {
  jsonResponse, originIsAllowed, preflightResponse, requireStaffPermission,
} from '../../cloudflare/seguridad-cloudinary.js';
import {
  decodeFirestoreFields, firestoreAdminListAll,
} from '../../cloudflare/firebase-admin-ligero.js';

const MAX_USERS = 3000;

function clean(value, max = 240) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function millis(value) {
  const date = value ? new Date(value) : null;
  const result = date?.getTime?.();
  return Number.isFinite(result) ? result : 0;
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  if (!originIsAllowed(origin, request.url)) return jsonResponse({ ok: false, error: 'Origen no permitido' }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url, 'GET, OPTIONS');
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405, origin, request.url);

  try {
    const actor = await requireStaffPermission(request, env, 'usuarios', 'gestionarFotos');
    const documents = await firestoreAdminListAll(env, 'users', MAX_USERS);
    const users = documents.map(document => {
      const uid = clean(String(document.name || '').split('/').pop(), 128);
      const profile = decodeFirestoreFields(document.fields || {});
      return {
        uid,
        name: clean(profile.name || profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' '), 160),
        username: clean(profile.username, 80),
        role: ['admin', 'agent', 'viewer', 'client', 'superadmin'].includes(profile.role) ? profile.role : 'client',
        photoURL: clean(profile.photoURL || profile.photoUrl, 1200),
        blocked: profile.blocked === true,
        createdAt: profile.createdAt || null,
        updatedAt: profile.updatedAt || profile.lastAccess || null,
        // Email y teléfono quedan fuera de esta proyección: la bandeja de
        // fotos no necesita datos de contacto para moderar una imagen.
      };
    }).filter(item => item.uid && item.role !== 'superadmin' || (item.uid && actor.isSuperAdmin));
    users.sort((a, b) => millis(b.updatedAt || b.createdAt) - millis(a.updatedAt || a.createdAt) || a.uid.localeCompare(b.uid));
    return jsonResponse({ ok: true, actorRole: actor.role, users }, 200, origin, request.url);
  } catch (error) {
    const status = Number(error?.status) || 400;
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudieron cargar las fotos').slice(0, 300) }, status, origin, request.url);
  }
}
