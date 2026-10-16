import { firestoreAdminMerge } from './firebase-admin-ligero.js';

const PATHS = new Set([
  '/api/admin-order-mutation', '/api/admin-catalog-delete', '/api/admin-engagement',
  '/api/admin-wholesale', '/api/local-commerce', '/api/push-admin',
  '/api/local-commerce-webhook', '/api/sheets-admin-webhook',
  '/api/visual-builder', '/api/visual-studio-global', '/api/cloudinary-delete',
]);
export function isAdminRevisionRequest(request) {
  return request.method === 'POST' && PATHS.has(new URL(request.url).pathname);
}

// Se ejecuta después del controlador autenticado y sólo publica un nonce y
// una fecha. No publica identidad, cambios de roles ni datos comerciales.
export async function publishConfirmedSiteRevision(env, request, response, { publish = firestoreAdminMerge } = {}) {
  if (!isAdminRevisionRequest(request) || !response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
  const [input, result] = await Promise.all([request.json().catch(() => null), response.clone().json().catch(() => null)]);
  const path = new URL(request.url).pathname;
  const confirmed = path === '/api/push-admin' ? result?.success === true : result?.ok === true;
  if (!input || !confirmed || result.result?.duplicate === true) return false;
  if (path === '/api/push-admin' && input.action === 'list') return false;
  if (path === '/api/local-commerce-webhook' && input.action === 'snapshot') return false;
  if (path.startsWith('/api/local-commerce') && Array.isArray(result.results) && !result.results.some(item => item.unchanged === false)) return false;
  if (path === '/api/sheets-admin-webhook' && input.action === 'diagnose') return false;
  // Guardar/cancelar un borrador no cambia la tienda publicada.
  if (path.startsWith('/api/visual-') && !['publish', 'publish-layout', 'restore'].includes(input.action)) return false;
  await publish(env, 'settings/siteRevision', {
    revision: { stringValue: crypto.randomUUID() },
    updatedAt: { timestampValue: new Date().toISOString() },
  });
  return true;
}
