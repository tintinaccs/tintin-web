// =============================================================
// TINTIN — Estudio de Código: núcleo seguro y contratos compartidos
// =============================================================

export const CODE_STUDIO_API_PREFIX = '/api/code-studio';
export const CODE_STUDIO_MAIN_BRANCH = 'main';
export const CODE_STUDIO_MAX_FILE_BYTES = 512 * 1024;
export const CODE_STUDIO_MAX_FILES_PER_COMMIT = 40;
export const CODE_STUDIO_MAX_SEARCH_RESULTS = 100;

const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*[\\\0])[A-Za-z0-9._@+()\[\]{} ,\-/]{1,320}$/;
const SAFE_BRANCH = /^(?!main$)(?!.*\.\.)(?!.*[~^:?*\[\\\s])(?!.*\/$)(?!\/)(?!.*\/\/)[A-Za-z0-9._\-/]{3,160}$/;
const SAFE_SHA = /^[a-f0-9]{40}$/i;

export const CODE_STUDIO_BLOCKED_PATHS = Object.freeze([
  '.git/',
  '.env',
  '.dev.vars',
  'node_modules/',
  'artifacts/',
  'firebase-service-account',
  'service-account',
  'private-key',
  'credentials',
  'secrets'
]);

export const CODE_STUDIO_RED_PATHS = Object.freeze([
  '.github/workflows/',
  'firestore.rules',
  '_headers',
  '_routes.json',
  'config/csp-runtime',
  'scripts/generar-csp-cloudflare',
  'cloudflare/seguridad-',
  'cloudflare/firebase-admin-',
  'functions/api/paypal-',
  'functions/api/admin-',
  'js/core/auth/',
  'checkout.html',
  'js/pages/checkout/'
]);

export const CODE_STUDIO_ORANGE_PATHS = Object.freeze([
  'functions/',
  'cloudflare/',
  'scripts/',
  'package.json',
  'package-lock.json',
  'admin.html',
  'js/admin/admin-app.js'
]);

export function normalizeCodePath(value) {
  const path = String(value || '').trim().replace(/^\.\//, '').replace(/\/{2,}/g, '/');
  if (!SAFE_PATH.test(path)) throw new Error('Ruta de archivo inválida');
  if (isBlockedCodePath(path)) throw new Error('Ese archivo está bloqueado por la política del Estudio de Código');
  return path;
}

export function isBlockedCodePath(value) {
  const path = String(value || '').trim().toLowerCase();
  return CODE_STUDIO_BLOCKED_PATHS.some(blocked => {
    const needle = blocked.toLowerCase();
    return needle.endsWith('/') ? path === needle.slice(0, -1) || path.startsWith(needle) : path === needle || path.includes(`/${needle}`) || path.includes(needle);
  });
}

export function normalizeBranchName(value) {
  const branch = String(value || '').trim();
  if (!SAFE_BRANCH.test(branch)) throw new Error('Nombre de rama inválido o no permitido');
  return branch;
}

export function normalizeSha(value, label = 'SHA') {
  const sha = String(value || '').trim();
  if (!SAFE_SHA.test(sha)) throw new Error(`${label} inválido`);
  return sha.toLowerCase();
}

export function classifyCodeRisk(pathValue) {
  const path = normalizeCodePath(pathValue).toLowerCase();
  if (CODE_STUDIO_RED_PATHS.some(prefix => path === prefix || path.startsWith(prefix))) return 'red';
  if (CODE_STUDIO_ORANGE_PATHS.some(prefix => path === prefix || path.startsWith(prefix))) return 'orange';
  if (/\.(?:js|mjs|cjs|json|html|css|rules|yml|yaml)$/i.test(path)) return 'yellow';
  return 'green';
}

export function requiresRecentAuth(paths = []) {
  return paths.some(path => classifyCodeRisk(path) === 'red');
}

export function requireRecentAuthToken(idToken, maxAgeSeconds = 10 * 60) {
  const part = String(idToken || '').split('.')[1] || '';
  let payload = {};
  try {
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    payload = JSON.parse(atob(normalized));
  } catch {}
  const authTime = Number(payload.auth_time || 0);
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (!authTime || age < 0 || age > Math.max(60, Number(maxAgeSeconds) || 600)) {
    throw Object.assign(new Error('Esta operación requiere volver a autenticarte antes de continuar'), { status: 403, code: 'recent_auth_required' });
  }
  return true;
}

export function sanitizeCommitMessage(value) {
  const message = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (message.length < 6 || message.length > 180) throw new Error('El mensaje de commit debe tener entre 6 y 180 caracteres');
  return message;
}

export function sanitizePullRequestTitle(value) {
  const title = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (title.length < 6 || title.length > 180) throw new Error('Título de PR inválido');
  return title;
}

export function sanitizePullRequestBody(value) {
  const body = String(value || '').replace(/\0/g, '').trim();
  if (body.length > 12000) throw new Error('Descripción de PR demasiado larga');
  return body;
}

export function validateChanges(changes) {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > CODE_STUDIO_MAX_FILES_PER_COMMIT) {
    throw new Error(`Un commit debe incluir entre 1 y ${CODE_STUDIO_MAX_FILES_PER_COMMIT} archivos`);
  }
  const seen = new Set();
  return changes.map(change => {
    const path = normalizeCodePath(change?.path);
    if (seen.has(path)) throw new Error(`Archivo duplicado en el commit: ${path}`);
    seen.add(path);
    const operation = String(change?.operation || 'update').trim().toLowerCase();
    if (!['create', 'update', 'delete'].includes(operation)) throw new Error(`Operación inválida para ${path}`);
    const baseSha = change?.baseSha ? normalizeSha(change.baseSha, `SHA base de ${path}`) : null;
    const content = operation === 'delete' ? '' : String(change?.content ?? '');
    if (new TextEncoder().encode(content).byteLength > CODE_STUDIO_MAX_FILE_BYTES) {
      throw new Error(`${path} supera el límite de ${CODE_STUDIO_MAX_FILE_BYTES} bytes`);
    }
    if (operation === 'create' && baseSha) throw new Error(`Un archivo nuevo no debe incluir SHA base: ${path}`);
    if (operation !== 'create' && !baseSha) throw new Error(`Falta SHA base para ${path}`);
    return { path, operation, content, baseSha, risk: classifyCodeRisk(path) };
  });
}

export function sanitizeSearchQuery(value) {
  const query = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (query.length < 2 || query.length > 160) throw new Error('Búsqueda inválida');
  return query;
}

export function isTextFile(pathValue) {
  const path = normalizeCodePath(pathValue);
  return /(?:^|\/)(?:Dockerfile|Makefile|LICENSE|README(?:\.[A-Za-z0-9]+)?)$/i.test(path) || /\.(?:js|mjs|cjs|ts|tsx|jsx|json|html|css|scss|md|txt|yml|yaml|xml|svg|rules|toml|ini|conf|sh|ps1|py|sql)$/i.test(path);
}

export function inferLanguage(pathValue) {
  const path = String(pathValue || '').toLowerCase();
  if (/\.(?:js|mjs|cjs)$/.test(path)) return 'javascript';
  if (/\.tsx?$/.test(path)) return 'typescript';
  if (/\.jsx$/.test(path)) return 'javascript';
  if (/\.json$/.test(path)) return 'json';
  if (/\.html?$/.test(path)) return 'html';
  if (/\.css$/.test(path)) return 'css';
  if (/\.md$/.test(path)) return 'markdown';
  if (/\.ya?ml$/.test(path)) return 'yaml';
  if (/\.xml$/.test(path)) return 'xml';
  if (/\.py$/.test(path)) return 'python';
  if (/\.sql$/.test(path)) return 'sql';
  if (/\.sh$/.test(path)) return 'shell';
  if (/\.ps1$/.test(path)) return 'powershell';
  return 'plaintext';
}

export function sanitizeExternalUrl(value, allowlist = []) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('URL externa inválida'); }
  if (url.protocol !== 'https:') throw new Error('Solo se permiten URLs HTTPS');
  const allowed = new Set(allowlist.map(host => String(host || '').trim().toLowerCase()).filter(Boolean));
  if (!allowed.has(url.hostname.toLowerCase())) throw new Error('El dominio externo no está autorizado');
  return url.toString();
}

export function makeWorkspaceBranch(seed = '') {
  const compact = String(seed || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'cambio';
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return `code-studio/${stamp}-${compact}`;
}

export function summarizeRisk(paths = []) {
  const order = ['green', 'yellow', 'orange', 'red'];
  let max = 'green';
  for (const path of paths) {
    const risk = classifyCodeRisk(path);
    if (order.indexOf(risk) > order.indexOf(max)) max = risk;
  }
  return max;
}

export function makeEvidence({ source, target, kind, path, line = null, evidence = 'confirmed', detail = '' }) {
  const allowedEvidence = new Set(['confirmed', 'probable', 'informational']);
  return {
    source: String(source || '').slice(0, 320),
    target: String(target || '').slice(0, 320),
    kind: String(kind || 'relation').slice(0, 80),
    path: path ? normalizeCodePath(path) : null,
    line: Number.isInteger(line) && line > 0 ? line : null,
    evidence: allowedEvidence.has(evidence) ? evidence : 'informational',
    detail: String(detail || '').slice(0, 500)
  };
}

function lineAt(content, index) {
  return content.slice(0, Math.max(0, index)).split('\n').length;
}

function symbolId(path, line, name) {
  return `symbol:${path}:${line}:${name}`;
}

function extractSymbols(path, content) {
  const symbols = [];
  const seen = new Set();
  const add = (match, name, type) => {
    if (!name || seen.has(`${match.index}:${name}`)) return;
    const line = lineAt(content, match.index);
    seen.add(`${match.index}:${name}`);
    symbols.push({ id: symbolId(path, line, name), name, type, line, index: match.index });
  };

  const patterns = [
    { type: 'class', regex: /\bclass\s+([A-Za-z_$][\w$]*)/g, group: 1 },
    { type: 'function', regex: /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g, group: 1 },
    { type: 'function', regex: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g, group: 1 }
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(content))) add(match, match[pattern.group], pattern.type);
  }
  return symbols.sort((first, second) => first.index - second.index);
}

function symbolAt(symbols, index, fallback) {
  let owner = fallback;
  for (const symbol of symbols) {
    if (symbol.index > index) break;
    owner = symbol.id;
  }
  return owner;
}

function safeFirebaseConsoleUrl(projectId, collection) {
  const project = String(projectId || '').trim();
  if (!/^[a-z][a-z0-9-]{4,29}$/i.test(project)) return '';
  return `https://console.firebase.google.com/project/${encodeURIComponent(project)}/firestore/databases/-default-/data/~2F${encodeURIComponent(collection)}`;
}

export function buildFileEvidenceGraph(files = [], options = {}) {
  const nodes = new Map();
  const edges = [];
  const analyzedFiles = [];
  const symbolsByName = new Map();
  const allowedHosts = Array.isArray(options.allowedExternalHosts) ? options.allowedExternalHosts : [];
  const addNode = (id, type, label = id, metadata = {}) => {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        type,
        label: String(label).slice(0, 160),
        path: metadata.path ? normalizeCodePath(metadata.path) : null,
        line: Number.isInteger(metadata.line) && metadata.line > 0 ? metadata.line : null,
        column: Number.isInteger(metadata.column) && metadata.column > 0 ? metadata.column : 1,
        symbol: String(metadata.symbol || '').slice(0, 160),
        url: String(metadata.url || '').slice(0, 1000),
        risk: metadata.path ? classifyCodeRisk(metadata.path) : String(metadata.risk || 'green')
      });
    } else if (metadata.url) {
      const existing = nodes.get(id);
      existing.url = String(metadata.url).slice(0, 1000);
      existing.type = type === 'external-link' ? type : existing.type;
      if (!existing.path && metadata.path) existing.path = normalizeCodePath(metadata.path);
      if (!existing.line && Number.isInteger(metadata.line) && metadata.line > 0) existing.line = metadata.line;
    }
  };

  for (const file of files) {
    let path;
    try { path = normalizeCodePath(file?.path); } catch { continue; }
    const content = String(file?.content || '');
    addNode(path, 'file', path.split('/').pop(), { path, line: 1 });
    const symbols = extractSymbols(path, content);
    analyzedFiles.push({ path, content, symbols });
    for (const symbol of symbols) {
      const matches = symbolsByName.get(symbol.name) || [];
      matches.push(symbol);
      symbolsByName.set(symbol.name, matches);
      addNode(symbol.id, symbol.type, symbol.name, { path, line: symbol.line, symbol: symbol.name });
      edges.push(makeEvidence({ source: path, target: symbol.id, kind: 'contains', path, line: symbol.line, evidence: 'confirmed', detail: `${symbol.type} ${symbol.name}` }));
    }

    const importRegex = /(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+[^'";]+?\s+from\s+|import\s*\()(['"])([^'"]+)\1/g;
    let match;
    while ((match = importRegex.exec(content))) {
      const specifier = match[2];
      const line = lineAt(content, match.index);
      const target = specifier.startsWith('.') ? resolveRelativeImport(path, specifier) : specifier;
      addNode(target, specifier.startsWith('.') ? 'file-reference' : 'external-service', target.split('/').pop(), specifier.startsWith('.') ? { path: target, line: 1 } : {});
      edges.push(makeEvidence({ source: symbolAt(symbols, match.index, path), target, kind: 'imports', path, line, evidence: specifier.startsWith('.') ? 'confirmed' : 'informational', detail: specifier }));
    }

    const fetchRegex = /fetch\s*\(\s*(['"`])([^'"`$]+)\1/g;
    while ((match = fetchRegex.exec(content))) {
      const target = match[2];
      const line = lineAt(content, match.index);
      addNode(target, target.startsWith('/api/') ? 'api' : 'external-service', target, { path, line });
      edges.push(makeEvidence({ source: symbolAt(symbols, match.index, path), target, kind: 'calls', path, line, evidence: 'confirmed', detail: 'fetch() literal' }));
    }

    const collectionRegex = /collection\s*\(\s*[^,]+,\s*(['"])([^'"]+)\1/g;
    while ((match = collectionRegex.exec(content))) {
      const target = `firestore:${match[2]}`;
      const line = lineAt(content, match.index);
      addNode(target, 'collection', match[2], { path, line, url: safeFirebaseConsoleUrl(options.firebaseProjectId, match[2]), risk: 'orange' });
      edges.push(makeEvidence({ source: symbolAt(symbols, match.index, path), target, kind: 'reads-or-writes', path, line, evidence: 'confirmed', detail: 'Firestore collection() literal' }));
    }

    const urlRegex = /https:\/\/[^\s'"`)<>]+/g;
    while ((match = urlRegex.exec(content))) {
      const rawUrl = match[0].replace(/[.,;]+$/, '');
      let safeUrl;
      try { safeUrl = sanitizeExternalUrl(rawUrl, allowedHosts); } catch { continue; }
      const line = lineAt(content, match.index);
      addNode(safeUrl, 'external-link', new URL(safeUrl).hostname, { path, line, url: safeUrl, risk: 'orange' });
      edges.push(makeEvidence({ source: symbolAt(symbols, match.index, path), target: safeUrl, kind: 'links-to', path, line, evidence: 'confirmed', detail: 'URL HTTPS allowlisted' }));
    }
  }

  const callEdges = new Set();
  const ignoredCalls = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'fetch', 'collection']);
  for (const file of analyzedFiles) {
    const callRegex = /\b([A-Za-z_$][\w$]*)\s*\(/g;
    let match;
    while ((match = callRegex.exec(file.content))) {
      const name = match[1];
      if (ignoredCalls.has(name)) continue;
      const targets = symbolsByName.get(name) || [];
      if (targets.length !== 1 || targets[0].index === match.index) continue;
      const source = symbolAt(file.symbols, match.index, file.path);
      const target = targets[0].id;
      if (source === target) continue;
      const key = `${source}\u0000${target}\u0000${match.index}`;
      if (callEdges.has(key)) continue;
      callEdges.add(key);
      edges.push(makeEvidence({
        source,
        target,
        kind: 'calls-symbol',
        path: file.path,
        line: lineAt(file.content, match.index),
        evidence: 'probable',
        detail: `Llamada literal a ${name}; resolución única entre los archivos analizados`
      }));
    }
  }

  return { nodes: [...nodes.values()], edges };
}

function resolveRelativeImport(sourcePath, specifier) {
  const sourceParts = sourcePath.split('/');
  sourceParts.pop();
  for (const part of specifier.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') sourceParts.pop();
    else sourceParts.push(part);
  }
  return sourceParts.join('/');
}

export function sanitizedAuditPayload(input = {}) {
  const safe = {
    actorUid: String(input.actorUid || '').slice(0, 128),
    actorEmail: String(input.actorEmail || '').slice(0, 254).toLowerCase(),
    action: String(input.action || '').slice(0, 80),
    branch: String(input.branch || '').slice(0, 160),
    commitSha: SAFE_SHA.test(String(input.commitSha || '')) ? String(input.commitSha).toLowerCase() : '',
    files: Array.isArray(input.files) ? input.files.slice(0, CODE_STUDIO_MAX_FILES_PER_COMMIT).map(path => String(path).slice(0, 320)) : [],
    risk: ['green', 'yellow', 'orange', 'red'].includes(input.risk) ? input.risk : 'green',
    result: String(input.result || '').slice(0, 80),
    detail: String(input.detail || '').replace(/(?:token|secret|private[_ -]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, '[redacted]').slice(0, 2000),
    createdAt: new Date().toISOString()
  };
  return safe;
}
