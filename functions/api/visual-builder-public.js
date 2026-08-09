import { decodeFirestoreFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';
import { requireVisualPageId, sanitizeVisualConfig } from '../../cloudflare/visual-builder-core.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET' } });
  try {
    const pageId = requireVisualPageId(new URL(request.url).searchParams.get('page'));
    const doc = await firestoreAdminGet(env, `visualBuilderPages/${pageId}`);
    const data = decodeFirestoreFields(doc?.fields || {});
    let raw = {};
    try { raw = JSON.parse(data.configJson || '{}'); } catch {}
    return Response.json({ ok: true, pageId, version: Number(data.version || 0), config: sanitizeVisualConfig(pageId, raw) }, {
      headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=300', 'x-content-type-options': 'nosniff' }
    });
  } catch (error) {
    console.error(JSON.stringify({ message: 'visual-builder-public failed', error: error?.message || String(error) }));
    return Response.json({ ok: false, config: null }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
}
