import { jsonResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { adminReviewAction } from '../../cloudflare/participacion-admin.js';

function sameSecret(provided, expected) {
  const left = new TextEncoder().encode(String(provided || ''));
  const right = new TextEncoder().encode(String(expected || ''));
  if (!right.length || left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function onRequestPost({ request, env }) {
  if (!sameSecret(request.headers.get('X-Tintin-Sheets-Secret'), env.SHEETS_ENGAGEMENT_SECRET)) {
    return jsonResponse({ ok: false, error: 'No autorizado' }, 401, '', request.url);
  }
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > 8 * 1024) throw new Error('Solicitud invalida');
    const input = JSON.parse(raw);
    const record = await adminReviewAction(env, { uid: 'google-sheets', email: 'tintinaccs@gmail.com' }, input);
    return jsonResponse({ ok: true, record }, 200, '', request.url);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error?.message || 'No se pudo sincronizar').slice(0, 300) }, 400, '', request.url);
  }
}
