/* =============================================================
   TINTIN — Núcleo del sistema de operaciones del panel admin.
   Lógica pura (sin DOM): etapas, progreso real, estado global,
   diagnóstico, exportación saneada e historial. La interfaz vive en
   sistema-operaciones-admin.js; este archivo se prueba en Node.
   ============================================================= */

export const STAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  OK: 'ok',
  WARNING: 'warning',
  ERROR: 'error',
  SKIPPED: 'skipped',
});

export const STAGE_SYMBOL = Object.freeze({
  pending: '○', running: '⟳', ok: '✓', warning: '!', error: '✕', skipped: '—',
});

export const STAGE_LABEL = Object.freeze({
  pending: 'Pendiente', running: 'En curso', ok: 'Correcto', warning: 'Advertencia', error: 'Error', skipped: 'Omitida',
});

export const GLOBAL_STATUS = Object.freeze({
  RUNNING: 'running', GREEN: 'green', YELLOW: 'yellow', RED: 'red', CANCELLED: 'cancelled',
});

export const GLOBAL_LABEL = Object.freeze({
  running: 'En curso', green: 'Correcto', yellow: 'Con advertencias', red: 'Con errores', cancelled: 'Cancelada',
});

export const GLOBAL_SYMBOL = Object.freeze({
  running: '⟳', green: '✓', yellow: '!', red: '✕', cancelled: '—',
});

export const DIAGNOSIS_KIND = Object.freeze({
  DETECTED: 'HECHO DETECTADO',
  CONFIRMED: 'CAUSA CONFIRMADA',
  POSSIBLE: 'POSIBLE CAUSA',
  UNKNOWN: 'NO DETERMINADO',
});

export const HISTORY_LIMIT = 100;
const FINISHED = new Set(['ok', 'warning', 'error', 'skipped']);
const SEQUENCE_KEY = 'tintin:admin-ops-seq:v1';
const MAX_TEXT = 4000;

const pad = (value, size = 2) => String(value).padStart(size, '0');
const toIso = value => (value instanceof Date ? value : new Date(value)).toISOString();

export function formatDay(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** ID legible y ordenable: OP-YYYYMMDD-NNNNNN (contador diario por navegador). */
export function nextOperationId(now = new Date(), storage = null) {
  const day = formatDay(now);
  try {
    if (!storage) throw new Error('sin almacenamiento');
    const stored = JSON.parse(storage.getItem(SEQUENCE_KEY) || 'null');
    const next = stored?.day === day && Number.isFinite(stored.n) ? stored.n + 1 : 1;
    storage.setItem(SEQUENCE_KEY, JSON.stringify({ day, n: next }));
    return `OP-${day}-${pad(next % 1000000, 6)}`;
  } catch {
    // Sin localStorage (modo privado estricto): un número aleatorio evita
    // repetir IDs dentro de la misma pestaña aunque no sean correlativos.
    return `OP-${day}-${pad(Math.floor(Math.random() * 1000000), 6)}`;
  }
}

/* ---------- Saneamiento ---------- */

const SECRET_FIELD = '(?:password|passwd|contrase(?:ñ|n)a|confirmation|id_?token|refresh_?token|access_?token|token|secret|client_?secret|authorization|cookie|set-cookie|api_?key|private_?key)';
const SANITIZERS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[clave privada oculta]'],
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, '[token oculto]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [oculto]'],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, '[clave API oculta]'],
  [new RegExp(`(["']?${SECRET_FIELD}["']?\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;&}\\]]+)`, 'gi'), '$1[oculto]'],
];

/** Elimina contraseñas, tokens, cookies, claves y secretos de cualquier texto. */
export function sanitizeText(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : safeStringify(value);
  for (const [pattern, replacement] of SANITIZERS) text = text.replace(pattern, replacement);
  return text.length > max ? `${text.slice(0, max)}… [recortado]` : text;
}

function safeStringify(value) {
  try { return JSON.stringify(value); } catch { return String(value); }
}

/* ---------- Errores y diagnóstico ---------- */

/** Extrae solo datos observables del error original, ya saneados. */
export function describeError(error) {
  if (!error) return null;
  const raw = typeof error === 'object' ? error : { message: String(error) };
  const status = Number(raw.httpStatus ?? raw.status);
  const stack = typeof raw.stack === 'string'
    ? raw.stack.split('\n').slice(0, 12).join('\n')
    : '';
  return {
    name: sanitizeText(raw.name || 'Error', 80),
    message: sanitizeText(raw.message || String(error), 800) || 'Sin mensaje',
    code: sanitizeText(raw.code || '', 120),
    httpStatus: Number.isFinite(status) && status > 0 ? status : null,
    endpoint: sanitizeText(raw.endpoint || '', 200),
    stack: sanitizeText(stack, 2000),
  };
}

const KNOWN_CAUSES = [
  [info => /unauthenticated|auth\/(user-token-expired|id-token-expired|requires-recent-login|invalid-user-token)/i.test(info.code) || info.httpStatus === 401,
    'La sesión no es válida o expiró. Volver a iniciar sesión suele resolverlo.'],
  [info => /permission-denied|insufficient-permission/i.test(info.code) || info.httpStatus === 403,
    'El servidor o las reglas de Firestore rechazaron el permiso para esta cuenta.'],
  [info => /app-?check/i.test(info.code) || /app ?check/i.test(info.message),
    'App Check rechazó la solicitud del navegador.'],
  [info => /not-found/i.test(info.code) || info.httpStatus === 404,
    'El recurso no existe o ya había sido eliminado.'],
  [info => /resource-exhausted|quota/i.test(info.code) || info.httpStatus === 429,
    'Se alcanzó un límite de cuota o de solicitudes.'],
  [info => /failed-precondition/i.test(info.code),
    'No se cumple una condición previa (por ejemplo, falta un índice de Firestore).'],
  [info => /deadline-exceeded|timeout/i.test(info.code) || info.httpStatus === 504 || /tiempo|timeout/i.test(info.message),
    'El servicio tardó más de lo permitido en responder.'],
  [info => /unavailable|network-request-failed/i.test(info.code) || /failed to fetch|networkerror|load failed/i.test(info.message),
    'No hubo conexión con el servicio (red caída o servicio no disponible).'],
  [info => info.httpStatus >= 500,
    'El servidor devolvió un error interno.'],
];

/**
 * Diagnóstico honesto: siempre el hecho observado; la causa solo es
 * "confirmada" si quien llama la aporta con evidencia (por ejemplo, el
 * servidor la informó). Un código conocido da una posible causa y, sin
 * evidencia, queda NO DETERMINADO.
 */
export function diagnose(errorInfo, explicit = []) {
  const entries = [];
  if (errorInfo?.message) entries.push({ kind: DIAGNOSIS_KIND.DETECTED, text: errorInfo.message });
  const provided = (Array.isArray(explicit) ? explicit : [explicit]).filter(item => item?.kind && item?.text);
  provided.forEach(item => entries.push({ kind: item.kind, text: sanitizeText(item.text, 800) }));
  const hasCause = provided.some(item => item.kind === DIAGNOSIS_KIND.CONFIRMED || item.kind === DIAGNOSIS_KIND.POSSIBLE);
  if (!hasCause && errorInfo) {
    const known = KNOWN_CAUSES.find(([matches]) => matches(errorInfo));
    entries.push(known
      ? { kind: DIAGNOSIS_KIND.POSSIBLE, text: known[1] }
      : { kind: DIAGNOSIS_KIND.UNKNOWN, text: 'No hay evidencia suficiente para determinar la causa.' });
  }
  return entries;
}

/* ---------- Operación y etapas ---------- */

export function createOperation({
  id, name, title, module = '', dangerous = false, stages = [], now = new Date(), retryOf = null,
} = {}) {
  return {
    id: id || nextOperationId(now),
    name: String(name || 'Operacion'),
    title: String(title || name || 'Operación'),
    module: String(module || ''),
    dangerous: Boolean(dangerous),
    retryOf,
    startedAt: toIso(now),
    finishedAt: null,
    status: GLOBAL_STATUS.RUNNING,
    error: null,
    stages: stages.map((stage, index) => ({
      id: String(stage.id || `etapa-${index + 1}`),
      label: String(stage.label || `Etapa ${index + 1}`),
      source: stage.source || '',
      destination: stage.destination || '',
      expected: stage.expected || '',
      dependsOn: Array.isArray(stage.dependsOn) ? stage.dependsOn.map(String) : [],
      status: STAGE_STATUS.PENDING,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      received: '',
      detail: '',
      affected: '',
      error: null,
      diagnosis: [],
      progress: null,
    })),
  };
}

export function getStage(operation, stageId) {
  const stage = operation?.stages?.find(item => item.id === stageId);
  if (!stage) throw new Error(`Etapa desconocida: ${stageId}`);
  return stage;
}

function closeStage(stage, status, info = {}, now = new Date()) {
  stage.status = status;
  stage.finishedAt = toIso(now);
  if (!stage.startedAt) stage.startedAt = stage.finishedAt;
  stage.durationMs = Math.max(0, Date.parse(stage.finishedAt) - Date.parse(stage.startedAt));
  if (info.received !== undefined) stage.received = sanitizeText(info.received, 1200);
  if (info.detail !== undefined) stage.detail = sanitizeText(info.detail, 1200);
  if (info.affected !== undefined) stage.affected = sanitizeText(info.affected, 1200);
  return stage;
}

export function startStage(operation, stageId, now = new Date()) {
  const stage = getStage(operation, stageId);
  stage.status = STAGE_STATUS.RUNNING;
  stage.startedAt = toIso(now);
  return stage;
}

export function completeStage(operation, stageId, info = {}, now = new Date()) {
  return closeStage(getStage(operation, stageId), STAGE_STATUS.OK, info, now);
}

export function warnStage(operation, stageId, info = {}, now = new Date()) {
  const stage = closeStage(getStage(operation, stageId), STAGE_STATUS.WARNING, info, now);
  stage.error = describeError(info.error);
  stage.diagnosis = info.diagnosis
    ? diagnose(stage.error, info.diagnosis)
    : diagnose(stage.error || (info.detail ? { message: sanitizeText(info.detail, 800) } : null));
  return stage;
}

/** Marca error y omite, en cascada, las etapas que dependen de esta. */
export function failStage(operation, stageId, info = {}, now = new Date()) {
  const stage = closeStage(getStage(operation, stageId), STAGE_STATUS.ERROR, info, now);
  stage.error = describeError(info.error) || (info.detail ? { message: sanitizeText(info.detail, 800), name: 'Error', code: '', httpStatus: null, endpoint: '', stack: '' } : null);
  stage.diagnosis = diagnose(stage.error, info.diagnosis);
  skipDependents(operation, stage, now);
  return stage;
}

export function skipStage(operation, stageId, reason = '', now = new Date()) {
  const stage = getStage(operation, stageId);
  if (FINISHED.has(stage.status)) return stage;
  return closeStage(stage, STAGE_STATUS.SKIPPED, { detail: reason || 'No se ejecutó.' }, now);
}

function skipDependents(operation, failed, now) {
  const queue = [failed];
  while (queue.length) {
    const current = queue.shift();
    for (const stage of operation.stages) {
      if (!stage.dependsOn.includes(current.id) || FINISHED.has(stage.status)) continue;
      closeStage(stage, STAGE_STATUS.SKIPPED, {
        detail: `No se ejecutó porque depende de "${current.label}", que ${current.status === STAGE_STATUS.ERROR ? 'falló' : 'no se ejecutó'}.`,
      }, now);
      queue.push(stage);
    }
  }
}

export function setStageProgress(operation, stageId, done, total) {
  const stage = getStage(operation, stageId);
  const safeTotal = Math.max(0, Number(total) || 0);
  stage.progress = { done: Math.min(safeTotal, Math.max(0, Number(done) || 0)), total: safeTotal };
  return stage;
}

/** Cierra la operación sin inventar resultados para etapas sin respuesta. */
export function finishOperation(operation, now = new Date(), { cancelled = false, cancelReason = '' } = {}) {
  for (const stage of operation.stages) {
    if (stage.status === STAGE_STATUS.RUNNING) {
      if (cancelled) closeStage(stage, STAGE_STATUS.SKIPPED, { detail: cancelReason || 'Cancelada por el usuario.' }, now);
      else {
        closeStage(stage, STAGE_STATUS.ERROR, { detail: 'La etapa no informó su resultado antes de finalizar.' }, now);
        stage.diagnosis = [{ kind: DIAGNOSIS_KIND.UNKNOWN, text: 'La etapa terminó sin confirmación del resultado.' }];
      }
    } else if (stage.status === STAGE_STATUS.PENDING) {
      closeStage(stage, STAGE_STATUS.SKIPPED, {
        detail: cancelled ? (cancelReason || 'Cancelada por el usuario.') : 'No llegó a ejecutarse.',
      }, now);
    }
  }
  operation.finishedAt = toIso(now);
  operation.status = cancelled ? GLOBAL_STATUS.CANCELLED : computeGlobalStatus(operation);
  return operation;
}

/* ---------- Progreso y resumen ---------- */

/** 0–100 según etapas terminadas; 100 significa "terminó", no "salió bien". */
export function computeProgress(operation) {
  const stages = operation?.stages || [];
  if (!stages.length) return operation?.finishedAt ? 100 : 0;
  if (operation.finishedAt) return 100;
  let units = 0;
  for (const stage of stages) {
    if (FINISHED.has(stage.status)) units += 1;
    else if (stage.status === STAGE_STATUS.RUNNING && stage.progress?.total > 0) {
      units += stage.progress.done / stage.progress.total;
    }
  }
  return Math.min(99, Math.floor((units / stages.length) * 100));
}

export function computeGlobalStatus(operation) {
  if (!operation?.finishedAt) return GLOBAL_STATUS.RUNNING;
  if (operation.status === GLOBAL_STATUS.CANCELLED) return GLOBAL_STATUS.CANCELLED;
  const statuses = operation.stages.map(stage => stage.status);
  if (operation.error || statuses.includes(STAGE_STATUS.ERROR)) return GLOBAL_STATUS.RED;
  if (statuses.includes(STAGE_STATUS.WARNING)) return GLOBAL_STATUS.YELLOW;
  return GLOBAL_STATUS.GREEN;
}

export function summarize(operation) {
  const stages = operation?.stages || [];
  const count = status => stages.filter(stage => stage.status === status).length;
  const summary = {
    total: stages.length,
    ok: count(STAGE_STATUS.OK),
    warning: count(STAGE_STATUS.WARNING),
    error: count(STAGE_STATUS.ERROR),
    skipped: count(STAGE_STATUS.SKIPPED),
  };
  const parts = [`${summary.ok} de ${summary.total} correctos`];
  if (summary.warning) parts.push(`${summary.warning} con advertencia`);
  if (summary.error) parts.push(`${summary.error} con error`);
  if (summary.skipped) parts.push(`${summary.skipped} omitida${summary.skipped === 1 ? '' : 's'}`);
  summary.text = parts.join(' · ');
  return summary;
}

/** Ventana de hasta tres etapas: anterior, actual y siguiente. */
export function stageWindow(operation) {
  const stages = operation?.stages || [];
  if (!stages.length) return { previous: null, current: null, next: null };
  let index = stages.findIndex(stage => stage.status === STAGE_STATUS.RUNNING);
  if (index < 0) index = stages.findIndex(stage => stage.status === STAGE_STATUS.PENDING);
  if (index < 0) index = stages.length - 1;
  return { previous: stages[index - 1] || null, current: stages[index], next: stages[index + 1] || null };
}

/* ---------- Servicios observados ---------- */

const SEVERITY = { ok: 1, skipped: 0, warning: 2, error: 3, pending: 0, running: 0 };

/** Estado de cada servicio según las etapas de ESTA operación que lo usaron. */
export function observedServices(operation) {
  const services = new Map();
  for (const stage of operation?.stages || []) {
    for (const service of [stage.source, stage.destination]) {
      const name = String(service || '').trim();
      if (!name) continue;
      const current = services.get(name);
      if (!current || SEVERITY[stage.status] > SEVERITY[current.status]) {
        services.set(name, { name, status: stage.status, stage: stage.label });
      }
    }
  }
  return [...services.values()];
}

/* ---------- Exportación ---------- */

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function slugName(name) {
  const clean = String(name || 'Operacion')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.map(word => word[0].toUpperCase() + word.slice(1)).join('') || 'Operacion';
}

export function diagnosticFileName(operation, now = new Date()) {
  const kind = operation.status === GLOBAL_STATUS.RED ? 'Error'
    : operation.status === GLOBAL_STATUS.YELLOW ? 'Advertencia' : 'Resultado';
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `Tintin_${kind}_${slugName(operation.name)}_${stamp}.txt`;
}

function line(label, value) {
  const text = sanitizeText(value, 1500);
  return text ? `  ${label}: ${text}` : '';
}

/**
 * Texto técnico exportable. Todo pasa por sanitizeText: nunca incluye
 * contraseñas, tokens, cookies, claves ni secretos.
 */
export function buildDiagnosticText(operation, environment = {}) {
  const summary = summarize(operation);
  const status = operation.status || computeGlobalStatus(operation);
  const total = operation.finishedAt ? Date.parse(operation.finishedAt) - Date.parse(operation.startedAt) : null;
  const out = [];
  out.push('TINTIN SYSTEM DIAGNOSTICS', '=========================');
  out.push(`Operación: ${sanitizeText(operation.title, 200)}`);
  out.push(`ID de operación: ${operation.id}`);
  if (operation.retryOf) out.push(`Reintento de: ${operation.retryOf}`);
  if (operation.module) out.push(`Módulo: ${sanitizeText(operation.module, 200)}`);
  out.push(`Estado global: ${GLOBAL_SYMBOL[status] || ''} ${GLOBAL_LABEL[status] || status}`);
  out.push(`Resultado: ${summary.text}`);
  out.push(`Inicio: ${operation.startedAt}`);
  out.push(`Fin: ${operation.finishedAt || 'sin finalizar'}`);
  out.push(`Duración total: ${formatDuration(total)}`);

  out.push('', 'ETAPAS', '------');
  operation.stages.forEach((stage, index) => {
    out.push(`${STAGE_SYMBOL[stage.status]} ${index + 1}. ${stage.label} — ${STAGE_LABEL[stage.status]} (${formatDuration(stage.durationMs)})`);
  });

  out.push('', 'DETALLE', '-------');
  operation.stages.forEach((stage, index) => {
    out.push(`[${index + 1}] ${stage.label}`);
    out.push(...[
      line('Estado', STAGE_LABEL[stage.status]),
      line('Origen', stage.source),
      line('Destino', stage.destination),
      line('Esperado', stage.expected),
      line('Recibido', stage.received),
      line('Detalle', stage.detail),
      line('Afectados', stage.affected),
      line('Depende de', stage.dependsOn.join(', ')),
      line('Inicio', stage.startedAt),
      line('Duración', formatDuration(stage.durationMs)),
      line('Código', [stage.error?.code, stage.error?.httpStatus ? `HTTP ${stage.error.httpStatus}` : ''].filter(Boolean).join(' · ')),
    ].filter(Boolean));
    stage.diagnosis.forEach(entry => out.push(`  ${entry.kind}: ${sanitizeText(entry.text, 800)}`));
    out.push('');
  });

  out.push('SERVICIOS', '---------');
  out.push('(Estado observado solo en esta operación; no es un chequeo general de salud.)');
  const services = observedServices(operation);
  if (!services.length) out.push('Sin servicios externos registrados.');
  services.forEach(service => out.push(`${STAGE_SYMBOL[service.status]} ${sanitizeText(service.name, 120)} — ${STAGE_LABEL[service.status]} (etapa: ${service.stage})`));
  if (environment.online !== undefined) out.push(`Conexión del navegador: ${environment.online ? 'en línea' : 'sin conexión'}`);

  out.push('', 'INFORMACIÓN TÉCNICA', '-------------------');
  const technical = [
    ['Página', environment.page],
    ['Rol', environment.role],
    ['Navegador', environment.userAgent],
    ['Idioma', environment.language],
    ['Zona horaria', environment.timeZone],
    ['Pantalla', environment.viewport],
    ['Versión del panel', environment.appVersion],
    ['Generado', environment.generatedAt],
  ];
  technical.forEach(([label, value]) => { if (value) out.push(`${label}: ${sanitizeText(value, 400)}`); });

  out.push('', 'ERROR ORIGINAL', '--------------');
  const errors = [operation.error, ...operation.stages.map(stage => stage.error)].filter(Boolean);
  if (!errors.length) out.push('Sin error original registrado.');
  errors.forEach(error => {
    out.push(`${error.name}: ${error.message}`);
    if (error.code) out.push(`Código: ${error.code}`);
    if (error.httpStatus) out.push(`HTTP: ${error.httpStatus}`);
    if (error.endpoint) out.push(`Endpoint: ${error.endpoint}`);
    if (error.stack) out.push(error.stack);
    out.push('');
  });
  return sanitizeText(out.join('\n'), 60000);
}

/* ---------- Historial ---------- */

/** Copia serializable y acotada para localStorage. */
export function toHistoryEntry(operation) {
  return {
    id: operation.id,
    name: operation.name,
    title: operation.title,
    module: operation.module,
    dangerous: operation.dangerous,
    retryOf: operation.retryOf,
    startedAt: operation.startedAt,
    finishedAt: operation.finishedAt,
    status: operation.status,
    reviewed: operation.status === GLOBAL_STATUS.GREEN,
    error: operation.error,
    stages: operation.stages.map(stage => ({ ...stage, progress: null })),
  };
}

export function appendHistory(history, entry, limit = HISTORY_LIMIT) {
  const list = Array.isArray(history) ? history.filter(item => item?.id && item.id !== entry.id) : [];
  return [entry, ...list].slice(0, limit);
}

export function filterHistory(history, filter = 'all') {
  const list = Array.isArray(history) ? history : [];
  if (filter === 'all') return list;
  return list.filter(item => item.status === filter);
}

export function countUnreviewed(history) {
  const list = Array.isArray(history) ? history : [];
  return {
    yellow: list.filter(item => item.status === GLOBAL_STATUS.YELLOW && !item.reviewed).length,
    red: list.filter(item => item.status === GLOBAL_STATUS.RED && !item.reviewed).length,
  };
}

export function parseHistory(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && Array.isArray(item.stages)).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}
