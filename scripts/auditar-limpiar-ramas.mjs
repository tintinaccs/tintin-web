import fs from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const mode = process.env.BRANCH_CLEANUP_MODE || 'audit';
const confirmation = process.env.BRANCH_CLEANUP_CONFIRMATION || '';
const outputJson = process.env.BRANCH_AUDIT_JSON || 'branch-audit.json';
const outputMarkdown = process.env.BRANCH_AUDIT_MARKDOWN || 'branch-audit.md';

const reviewedObsoleteBranches = new Map([
  ['agent/phase8-tree-test', 'Rama temporal con archivos y workflows de prueba de árbol'],
  ['chatgpt/global-hardening-20260707', 'Trabajo antiguo superado por la reorganización y auditoría integral actual'],
  ['claude/user-mgmt-bulk-organize-7u20jo', 'Implementación monolítica antigua e incompatible, reemplazada por módulos actuales de usuarios y colecciones'],
  ['claude/user-mgmt-bulk-organize-sf4tqu', 'Duplicado de la implementación monolítica antigua de usuarios y colecciones ya revisada'],
  ['diagnostic/prod-cls-verification-20260806', 'Diagnóstico temporal de CLS ya incorporado y validado en main'],
  ['feature/firebase-web-push', 'Duplicado exacto de la rama conservada claude/firebase-web-push-jun4le'],
  ['fix/catalog-stock-priority-realtime', 'Cambio antiguo de catálogo superado por el estado comercial y auditorías actuales'],
  ['fix/hide-cookie-banner-superadmin', 'Corrección antigua de privacidad absorbida por el runtime y panel actuales'],
  ['fix/loader-logo-background-fullscreen', 'Corrección antigua de loader superada por el sistema de carga validado'],
  ['fix/loader-logo-oficial-instantaneo-20260731', 'Variación antigua del loader y caché sustituida por el sistema actual auditado'],
  ['fix/phase8-users-audit-permissions', 'Implementación antigua de roles sustituida por la arquitectura modular y pruebas actuales'],
  ['fix/phase8-users-load-permissions-rules', 'Corrección antigua de usuarios y reglas reemplazada por la arquitectura y seguridad actuales'],
  ['fix/reactivate-analytics-throttle', 'Throttle de analítica ya incorporado en las reglas actuales de Firestore'],
  ['refactor/integrar-cierre-nombres-global', 'Rama de integración temporal cuyo resultado final ya fue fusionado'],
  ['temp/noop-test', 'Rama temporal de prueba sin trabajo de producto vigente'],
  ['tmp/admin-cls-rebase', 'Rama temporal de rebase de CLS ya incorporada y validada'],
  ['tmp/admin-cls-rebase-20260806', 'Segundo rebase temporal de CLS cuyos cambios ya están incorporados y auditados']
]);

if (!token) throw new Error('Falta GITHUB_TOKEN');
if (!repository || !repository.includes('/')) throw new Error('Falta GITHUB_REPOSITORY');
if (!['audit', 'delete'].includes(mode)) throw new Error(`Modo inválido: ${mode}`);
if (mode === 'delete' && confirmation !== 'ELIMINAR_SOLO_RAMAS_SEGURAS') {
  throw new Error('La eliminación requiere la confirmación exacta ELIMINAR_SOLO_RAMAS_SEGURAS');
}

const [owner, repo] = repository.split('/');
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'tintin-branch-audit'
};

async function api(path, options = {}) {
  const response = await fetch(path.startsWith('http') ? path : `${apiBase}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || 'GET'} ${path}: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function paginate(path) {
  const results = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const items = await api(`${path}${separator}per_page=100&page=${page}`);
    results.push(...items);
    if (items.length < 100) break;
  }
  return results;
}

function encodedRef(branch) {
  return branch.split('/').map(encodeURIComponent).join('/');
}

function isPermanentBranch(branch, openHeads) {
  return branch === 'main'
    || branch.startsWith('backup/')
    || branch === 'backup-before-fixes-20260715'
    || openHeads.has(branch);
}

const [branches, openPulls, closedPulls] = await Promise.all([
  paginate('/branches'),
  paginate('/pulls?state=open'),
  paginate('/pulls?state=closed&sort=updated&direction=desc')
]);

const openHeads = new Set(openPulls.map(pr => pr.head?.ref).filter(Boolean));
const mergedHeads = new Set(
  closedPulls.filter(pr => pr.merged_at).map(pr => pr.head?.ref).filter(Boolean)
);

const records = [];
for (const branchInfo of branches) {
  const branch = branchInfo.name;
  const record = {
    branch,
    sha: branchInfo.commit?.sha || null,
    classification: 'review',
    reason: 'Contiene historial no clasificado',
    aheadBy: null,
    behindBy: null,
    deleted: false
  };

  if (isPermanentBranch(branch, openHeads)) {
    record.classification = 'keep';
    record.reason = branch === 'main'
      ? 'Rama principal'
      : branch.startsWith('backup/') || branch === 'backup-before-fixes-20260715'
        ? 'Rama de respaldo'
        : 'Rama vinculada a un Pull Request abierto';
    records.push(record);
    continue;
  }

  if (reviewedObsoleteBranches.has(branch)) {
    record.classification = 'safe-delete';
    record.reason = `Revisada explícitamente: ${reviewedObsoleteBranches.get(branch)}`;
    records.push(record);
    continue;
  }

  if (mergedHeads.has(branch)) {
    record.classification = 'safe-delete';
    record.reason = 'Tiene un Pull Request fusionado y no tiene PR abierto';
    records.push(record);
    continue;
  }

  try {
    const comparison = await api(`/compare/main...${encodedRef(branch)}`);
    record.aheadBy = comparison.ahead_by;
    record.behindBy = comparison.behind_by;
    if (comparison.ahead_by === 0) {
      record.classification = 'safe-delete';
      record.reason = 'No contiene commits únicos respecto de main';
    } else {
      record.reason = `Contiene ${comparison.ahead_by} commit(s) no presentes en main`;
    }
  } catch (error) {
    record.classification = 'review';
    record.reason = `No se pudo comparar automáticamente: ${error.message}`;
  }
  records.push(record);
}

const safeToDelete = records.filter(record => record.classification === 'safe-delete');
if (mode === 'delete') {
  for (const record of safeToDelete) {
    await api(`/git/refs/heads/${encodedRef(record.branch)}`, { method: 'DELETE' });
    record.deleted = true;
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  repository,
  mode,
  total: records.length,
  keep: records.filter(record => record.classification === 'keep').length,
  safeDelete: safeToDelete.length,
  review: records.filter(record => record.classification === 'review').length,
  deleted: records.filter(record => record.deleted).length
};

await fs.writeFile(outputJson, `${JSON.stringify({ summary, records }, null, 2)}\n`);

const sections = [
  ['Conservar', 'keep'],
  ['Seguras para eliminar', 'safe-delete'],
  ['Revisión manual', 'review']
];
let markdown = `# Auditoría de ramas\n\n`;
markdown += `- Repositorio: \`${repository}\`\n`;
markdown += `- Fecha: \`${summary.generatedAt}\`\n`;
markdown += `- Modo: \`${mode}\`\n`;
markdown += `- Total: **${summary.total}**\n`;
markdown += `- Conservar: **${summary.keep}**\n`;
markdown += `- Seguras para eliminar: **${summary.safeDelete}**\n`;
markdown += `- Revisión manual: **${summary.review}**\n`;
markdown += `- Eliminadas: **${summary.deleted}**\n\n`;

for (const [title, classification] of sections) {
  markdown += `## ${title}\n\n`;
  const matches = records.filter(record => record.classification === classification);
  if (matches.length === 0) {
    markdown += '_Ninguna._\n\n';
    continue;
  }
  for (const record of matches) {
    const status = record.deleted ? ' — eliminada' : '';
    markdown += `- \`${record.branch}\`${status}: ${record.reason}\n`;
  }
  markdown += '\n';
}

await fs.writeFile(outputMarkdown, markdown);
console.log(JSON.stringify(summary, null, 2));
