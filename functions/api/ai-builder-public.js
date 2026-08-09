import { decodeFirestoreFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET' } });
  try {
    const doc = await firestoreAdminGet(env, 'aiBuilder/state');
    const data = doc ? decodeFirestoreFields(doc.fields) : {};
    const blocks = JSON.parse(data.configJson || '[]');
    return new Response(JSON.stringify({ ok: true, version: Number(data.version || 0), blocks: Array.isArray(blocks) ? blocks : [] }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, stale-while-revalidate=300', 'x-content-type-options': 'nosniff' }
    });
  } catch (error) {
    console.error('[ai-builder-public]', error?.message || error);
    return new Response(JSON.stringify({ ok: false, blocks: [] }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
