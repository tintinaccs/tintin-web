import { jsonResponse, originIsAllowed, preflightResponse, rateLimitErrorResponse } from '../../cloudflare/seguridad-cloudinary.js';
import { decodeFirestoreFields, encodeFirestoreFields, firestoreAdminGet, firestoreAdminCommit } from '../../cloudflare/firebase-admin-ligero.js';
import { limitByIp, reserveSharedRateLimit } from '../../cloudflare/rate-limit-compartido.js';

const KINDS = new Set(['session', 'presence', 'aggregate', 'authFailure']);
const FAILURE_REASONS = new Set(['handoff-recovery-timeout', 'handoff-restore-error', 'auth-restore-fallback']);
const clean = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
const invalid = () => Object.assign(new Error('Evento inválido.'), { status: 400 });
const safeId = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(value) || /^__.*__$/.test(value)) throw invalid();
  return value;
};

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > 4096) throw invalid();
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw invalid(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw invalid(); }
}

export async function handleSiteActivity({ request, env }, {
  get = firestoreAdminGet, commit = firestoreAdminCommit,
  ipLimit = limitByIp, reserve = reserveSharedRateLimit, now = () => new Date(),
} = {}) {
  const origin = request.headers.get('origin') || '';
  if (!origin || !originIsAllowed(origin, request.url)) return jsonResponse({ ok: false }, 403, origin, request.url);
  if (request.method === 'OPTIONS') return preflightResponse(origin, request.url);
  if (request.method !== 'POST') return jsonResponse({ ok: false }, 405, origin, request.url);
  try {
    const input = await readBody(request);
    if (!KINDS.has(input?.kind)) throw invalid();
    const kind = input.kind;
    const date = now();
    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const route = new URL(clean(input.route, 500) || '/', new URL(request.url).origin).pathname.slice(0, 220);
    if (kind === 'authFailure' && !FAILURE_REASONS.has(input.reason)) throw invalid();
    if (['session', 'presence'].includes(kind)) {
      if (input.consent !== true) throw invalid();
      safeId(input.visitorId); safeId(input.sessionId);
    }
    // Cuotas compartidas: cambiar los IDs del navegador o reiniciar un isolate
    // no reinicia el límite por IP ni el presupuesto global de eventos.
    await ipLimit(request, env, { id: 'site-activity', limit: 60, windowMs: 60_000 });
    await reserve(env, { id: 'site-activity-budget', identity: 'all-visitors', limit: 20_000, windowMs: 86_400_000 });
    if (kind === 'authFailure') {
      await ipLimit(request, env, { id: 'auth-diagnostic', limit: 6, windowMs: 3_600_000 });
      await commit(env, [{ path: `authDiagnosticFailures/${crypto.randomUUID()}`, fields: encodeFirestoreFields({
        code: 'REDIRECT_LOOP_BROKEN', reason: input.reason, source: 'admin-guard', route, createdAt: date,
      }), currentDocument: { exists: false } }]);
    } else {
      const gate = await get(env, 'settings/storeGate');
      if (gate && decodeFirestoreFields(gate.fields).storeOpen !== true) return jsonResponse({ ok: false }, 403, origin, request.url);
      if (kind === 'aggregate') {
        // CAS protege el contador frente a peticiones concurrentes; no se acepta
        // un importe ni una operación de incremento aportados por el cliente.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const previous = await get(env, `siteAggregate/${dayKey}`);
          const count = previous ? decodeFirestoreFields(previous.fields).totalVisits : 0;
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid aggregate');
          try {
            await commit(env, [{ path: `siteAggregate/${dayKey}`, fields: encodeFirestoreFields({ dayKey, totalVisits: count + 1, updatedAt: date }),
              currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false } }]);
            break;
          } catch (error) { if (error.status !== 409 || attempt === 4) throw error; }
        }
      } else {
        const path = kind === 'session' ? `siteTraffic/${dayKey}/sessions/${input.sessionId}` : `sitePresence/${input.visitorId}`;
        const previous = await get(env, path);
        // Sesión duplicada y heartbeat adelantado son no-ops, sin escrituras.
        if (previous && (kind === 'session' || date.getTime() - Date.parse(decodeFirestoreFields(previous.fields).lastSeen) < 20_000)) {
          return jsonResponse({ ok: true, duplicate: true }, 202, origin, request.url);
        }
        const cf = request.cf || {};
        const countryCode = /^[A-Z]{2}$/.test(cf.country || '') ? cf.country : '';
        const fields = encodeFirestoreFields({
          visitorId: input.visitorId, sessionId: input.sessionId, userId: '',
          city: clean(cf.city, 80), region: clean(cf.region, 80), country: countryCode, countryCode,
          geoSource: countryCode || cf.city ? 'cloudflare' : 'unavailable',
          ...(kind === 'session' ? { dayKey, landingPage: route, startedAt: date } : { page: route, lastSeen: date }),
        });
        try {
          await commit(env, [{ path, fields, currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false } }]);
        } catch (error) { if (error.status !== 409) throw error; /* otra pestaña ganó la misma identidad */ }
      }
    }
    return jsonResponse({ ok: true }, 202, origin, request.url);
  } catch (error) {
    return rateLimitErrorResponse(error, origin, request.url) || jsonResponse({ ok: false, error: error.status === 400 ? 'Evento inválido.' : 'No se pudo registrar el evento.' }, error.status === 400 ? 400 : 503, origin, request.url);
  }
}

export function onRequest(context) { return handleSiteActivity(context); }
