import {
  decodeFirestoreFields,
  encodeFirestoreFields,
  firestoreAdminBatchCommit,
  firestoreAdminGet,
} from '../../cloudflare/firebase-admin-ligero.js';
import {
  jsonResponse,
  originIsAllowed,
  preflightResponse,
  requireSuperAdmin,
  statusFromError,
} from '../../cloudflare/seguridad-cloudinary.js';

const MAX_BODY_BYTES = 96 * 1024;
const JOB_ID = /^imp_[A-Za-z0-9_-]{8,120}$/;
const STATES = new Set(['PREVIEW', 'READY', 'RUNNING', 'PAUSED', 'FAILED', 'COMPLETED', 'CANCELLED']);
const TRANSITIONS = new Map([
  ['PREVIEW', new Set(['READY', 'CANCELLED'])],
  ['READY', new Set(['RUNNING', 'PAUSED', 'CANCELLED'])],
  ['RUNNING', new Set(['PAUSED', 'FAILED', 'COMPLETED', 'CANCELLED'])],
  ['PAUSED', new Set(['READY', 'RUNNING', 'CANCELLED'])],
  ['FAILED', new Set(['READY', 'CANCELLED'])],
  ['COMPLETED', new Set()],
  ['CANCELLED', new Set()],
]);

function clean(value, max = 500) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function safeJobId(value) {
  const jobId = clean(value, 120);
  if (!JOB_ID.test(jobId)) throw Object.assign(new Error('Identificador de importación inválido.'), { status: 400 });
  return jobId;
}

function finiteInt(value, fallback = 0, max = 10_000_000) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? Math.min(number, max) : fallback;
}

function decodeJob(document) {
  if (!document) return null;
  return { id: document.name?.split('/').pop() || '', ...decodeFirestoreFields(document.fields || {}) };
}

function auditFields(actor, action, jobId, detail) {
  const now = new Date();
  return encodeFirestoreFields({
    action,
    targetType: 'importJob',
    targetId: jobId,
    targetLabel: jobId,
    details: clean(detail, 800),
    actorEmail: clean(actor.email, 254).toLowerCase(),
    actorRole: 'superadmin',
    createdAt: now,
    origin: 'superadmin-import-job',
  });
}

async function loadOwnedJob(env, actor, jobId) {
  const document = await firestoreAdminGet(env, `importJobs/${jobId}`);
  const job = decodeJob(document);
  if (!job) throw Object.assign(new Error('El import job no existe.'), { status: 404 });
  if (job.createdByUid !== actor.uid && job.createdByEmail !== actor.email) {
    throw Object.assign(new Error('El import job pertenece a otra sesión administrativa.'), { status: 403 });
  }
  return { document, job };
}

async function createJob(env, actor, body) {
  const jobId = safeJobId(body.jobId);
  const existing = await firestoreAdminGet(env, `importJobs/${jobId}`);
  if (existing) throw Object.assign(new Error('El import job ya existe; usá resume para continuar.'), { status: 409 });
  const now = new Date();
  const total = finiteInt(body.total);
  const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
  const fields = encodeFirestoreFields({
    jobId,
    source: clean(body.source || 'shopify', 80),
    fileName: clean(body.fileName, 240),
    fileBytes: finiteInt(body.fileBytes, 0, 500 * 1024 * 1024),
    fileChecksum: clean(body.fileChecksum, 128),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    createdByEmail: clean(actor.email, 254).toLowerCase(),
    status: 'PREVIEW',
    products: finiteInt(summary.products ?? total),
    variants: finiteInt(summary.variants),
    images: finiteInt(summary.images),
    errors: finiteInt(summary.errors),
    warnings: finiteInt(summary.warnings),
    processed: 0,
    total,
    progress: 0,
    lastCheckpoint: 0,
    batches: finiteInt(body.batchCount, 0, 500_000),
    strategy: clean(body.strategy || 'SKIP', 20),
    dryRun: true,
    catalogMigration: 'not-executed',
  });
  const auditId = `EVT_IMPORT_${crypto.randomUUID().replaceAll('-', '')}`;
  await firestoreAdminBatchCommit(env, [
    { path: `importJobs/${jobId}`, fields, currentDocument: { exists: false } },
    { path: `auditLog/${auditId}`, fields: auditFields(actor, 'import_job_created', jobId, 'Preview Shopify creado; no se escribió catálogo.') },
  ]);
  return { jobId, status: 'PREVIEW', total, dryRun: true, catalogMigration: 'not-executed' };
}

async function transitionJob(env, actor, body) {
  const jobId = safeJobId(body.jobId);
  const { document, job } = await loadOwnedJob(env, actor, jobId);
  const next = clean(body.status, 20).toUpperCase();
  if (!STATES.has(next) || !TRANSITIONS.get(job.status)?.has(next)) {
    throw Object.assign(new Error(`Transición de importación no permitida: ${job.status} → ${next}.`), { status: 409 });
  }
  const now = new Date();
  const processed = Math.min(finiteInt(body.processed, Number(job.processed || 0)), Number(job.total || 0));
  const progress = Number(job.total || 0) ? Math.round(processed / Number(job.total) * 100) : 0;
  const fields = encodeFirestoreFields({
    status: next,
    updatedAt: now,
    processed,
    progress,
    lastCheckpoint: finiteInt(body.lastCheckpoint, Number(job.lastCheckpoint || 0)),
    ...(body.error ? { lastError: clean(body.error, 800) } : {}),
  });
  const auditId = `EVT_IMPORT_${crypto.randomUUID().replaceAll('-', '')}`;
  await firestoreAdminBatchCommit(env, [
    { path: `importJobs/${jobId}`, fields, mergeFields: Object.keys(decodeFirestoreFields(fields)), currentDocument: { updateTime: document.updateTime } },
    { path: `auditLog/${auditId}`, fields: auditFields(actor, `import_job_${next.toLowerCase()}`, jobId, `Estado ${job.status} → ${next}.`) },
  ]);
  return { jobId, status: next, processed, total: Number(job.total || 0), progress, dryRun: true };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin') || '';
  const requestUrl = request.url;
  if (!origin || !originIsAllowed(origin, requestUrl)) return jsonResponse({ ok: false, error: 'Origen no permitido.' }, 403, origin, requestUrl);
  if (request.method === 'OPTIONS') return preflightResponse(origin, requestUrl, 'POST, OPTIONS');
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido.' }, 405, origin, requestUrl);
  try {
    const actor = await requireSuperAdmin(request);
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw Object.assign(new Error('Solicitud de importación demasiado grande.'), { status: 413 });
    const body = JSON.parse(raw);
    const action = clean(body.action, 30).toLowerCase();
    if (action === 'create') return jsonResponse({ ok: true, job: await createJob(env, actor, body) }, 201, origin, requestUrl);
    if (action === 'transition') return jsonResponse({ ok: true, job: await transitionJob(env, actor, body) }, 200, origin, requestUrl);
    if (action === 'status') {
      const { job } = await loadOwnedJob(env, actor, safeJobId(body.jobId));
      return jsonResponse({ ok: true, job }, 200, origin, requestUrl);
    }
    throw Object.assign(new Error('Acción de import job inválida.'), { status: 400 });
  } catch (error) {
    console.error('[admin-import-job]', error?.message || error);
    return jsonResponse({ ok: false, error: clean(error?.message || 'No se pudo gestionar el import job.', 400) }, statusFromError(error, 500), origin, requestUrl);
  }
}
