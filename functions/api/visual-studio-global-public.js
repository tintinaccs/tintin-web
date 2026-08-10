import { jsonResponse, originIsAllowed, preflightResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, firestoreAdminGet } from '../../cloudflare/firebase-admin-ligero.js';
import { sanitizeGlobalStudioConfig } from '../../cloudflare/visual-studio-global-core.js';

const safeJson = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };

export async function onRequest(context) {
  const { request, env } = context; const origin=request.headers.get('origin') || ''; const requestUrl=request.url;
  if (!originIsAllowed(origin, requestUrl)) return jsonResponse({ok:false,error:'Origen no permitido.'},403,origin,requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'GET, OPTIONS');
  if (request.method !== 'GET') return jsonResponse({ok:false,error:'Método no permitido.'},405,origin,requestUrl);
  try {
    const doc=await firestoreAdminGet(env,'visualStudioGlobal/state'); const data=decodeFirestoreFields(doc?.fields || {});
    const response=jsonResponse({ok:true,version:Number(data.version || 0),config:sanitizeGlobalStudioConfig(safeJson(data.configJson,{}))},200,origin,requestUrl);
    response.headers.set('cache-control','public, max-age=30, stale-while-revalidate=60'); return response;
  } catch (error) {
    console.error(JSON.stringify({message:'visual-studio-global-public failed',error:error?.message || String(error)}));
    return jsonResponse({ok:true,version:0,config:{popups:[],campaigns:[]}},200,origin,requestUrl);
  }
}
