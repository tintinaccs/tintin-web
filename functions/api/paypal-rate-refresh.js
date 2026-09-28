import { firestoreAdminGet, firestoreAdminReplace, decodeFirestoreFields, encodeFirestoreFields } from '../../cloudflare/firebase-admin-ligero.js';
import { GitHubActionsOidcError, verifyGitHubActionsOidc } from '../lib/github-actions-oidc.js';
import { jsonResponse, rateLimit } from '../lib/operational-guard.js';

const BCP_URL = 'https://www.bcp.gov.py/webapps/web/cotizacion/monedas';
const WORKFLOW_REF = 'tintinaccs/tintin-web/.github/workflows/actualizar-tasa-paypal-bcp.yml@refs/heads/main';
const AUDIENCE = 'tintin-paypal-fx-refresh';

export function parseBcpUsdRate(html) {
  const source = String(html || '');
  const dateMatch = source.match(/(?:id|name)=["'](?:dp_cotizacion|fecha)["'][^>]*value=["'](\d{2})\/(\d{2})\/(\d{4})["']/i)
    || source.match(/value=["'](\d{2})\/(\d{2})\/(\d{4})["'][^>]*(?:id|name)=["'](?:dp_cotizacion|fecha)["']/i);
  const table = source.match(/<table[^>]*id=["']cotizacion-interbancaria["'][\s\S]*?<\/table>/i)?.[0] || '';
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
  let rate = NaN;
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => match[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim());
    if (!cells.some(cell => /\bUSD\b|D[oó]lar/i.test(cell))) continue;
    const candidates = cells.map(cell => cell.replace(/\./g, '').replace(',', '.')).map(Number).filter(value => Number.isFinite(value) && value >= 1000 && value <= 50000);
    const candidate = candidates.at(-1);
    if (candidate) { rate = candidate; break; }
  }
  if (!dateMatch || !Number.isFinite(rate)) throw new Error('bcp_rate_not_found');
  const [, day, month, year] = dateMatch;
  return { rate, sourceDate: `${year}-${month}-${day}` };
}

export async function onRequestPost({ request, env }) {
  const limit = rateLimit(request, { id: 'paypal-rate-refresh', limit: 4, windowMs: 60_000 });
  if (!limit.allowed) return jsonResponse({ ok: false, error: 'rate_limited' }, 429, limit.headers);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonResponse({ ok: false, error: 'missing_oidc_token' }, 401, limit.headers);
  try {
    await verifyGitHubActionsOidc(token, { audience: AUDIENCE, workflowRef: WORKFLOW_REF });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof GitHubActionsOidcError ? error.code : 'invalid_oidc_token' }, 401, limit.headers);
  }
  try {
    const response = await fetch(BCP_URL, { headers: { accept: 'text/html', 'user-agent': 'TintinAccesorios-Paypal-FX/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`bcp_http_${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('bcp_response_too_large');
    const { rate, sourceDate } = parseBcpUsdRate(html);
    const sourceAt = Date.parse(`${sourceDate}T12:00:00Z`);
    const ageMs = Date.now() - sourceAt;
    if (!Number.isFinite(sourceAt) || ageMs < -86_400_000 || ageMs > 7 * 86_400_000) throw new Error('bcp_rate_stale');
    const currentDoc = await firestoreAdminGet(env, 'settings/paymentFx');
    const current = decodeFirestoreFields(currentDoc?.fields || {});
    if (current.sourceDate && current.sourceDate > sourceDate) throw new Error('bcp_rate_older_than_current');
    const updatedAt = new Date().toISOString();
    await firestoreAdminReplace(env, 'settings/paymentFx', encodeFirestoreFields({ pygPerUsd: rate, source: 'BCP', sourceUrl: BCP_URL, sourceDate, updatedAt }));
    return jsonResponse({ ok: true, source: 'BCP', sourceDate, rate, updatedAt, paymentsEnabled: false }, 200, limit.headers);
  } catch (error) {
    console.error('[paypal-rate-refresh]', error?.message || error);
    return jsonResponse({ ok: false, error: String(error?.message || 'rate_refresh_failed').slice(0, 100) }, 502, limit.headers);
  }
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  return onRequestPost(context);
}
