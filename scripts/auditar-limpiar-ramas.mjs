import fs from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const mode = process.env.BRANCH_CLEANUP_MODE || 'audit';
const confirmation = process.env.BRANCH_CLEANUP_CONFIRMATION || '';
const outputJson = process.env.BRANCH_AUDIT_JSON || 'branch-audit.json';
const outputMarkdown = process.env.BRANCH_AUDIT_MARKDOWN || 'branch-audit.md';

// La clasificación usa únicamente evidencia de GitHub; no existen listas manuales de excepciones.
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

function createSummary(records) {
  return {
    generatedAt: new Date().toISOString(),
    repository,
    mode,
    total: records.length,
    keep: records.filter(record => record.classification === 'keep').length,
    safeDelete: records.filter(record => record.classification === 'safe-delete').length,
    review: records.filter(record => record.classification === 'review').length,
    deleted: records.filter(record => record.deleted).length,
    deleteErrors: records.filter(record => record.deleteError).length,
    deleteSkipped: records.filter(record => record.deleteSkipped).length
  };
}

const [branches, openPulls, closedPulls] = await Promise.all([
  paginate('/branches'),
  paginate('/pulls?state=open'),
  paginate('/pulls?state=closed&sort=updated&direction=desc')
]);

const openHeads = new Set(
  openPulls
    .filter(pr => pr.head?.repo?.full_name === repository)
    .map(pr => pr.head?.ref)
    .filter(Boolean)
);

const mergedHeadShas = new Map();
for (const pr of closedPulls) {
  const mergedIntoMain = pr.merged_at
    && pr.head?.repo?.full_name === repository
    && pr.base?.repo?.full_name === repository
    && pr.base?.ref === 'main'
    && pr.head?.ref
    && pr.head?.sha;
  if (!mergedIntoMain) continue;
  if (!mergedHeadShas.has(pr.head.ref)) mergedHeadShas.set(pr.head.ref, new Set());
  mergedHeadShas.get(pr.head.ref).add(pr.head.sha);
}

const records = [];
for (const branchInfo of branches) {
  const branch = branchInfo.name;
  const currentSha = branchInfo.commit?.sha || null;
  const record = {
    branch,
    sha: currentSha,
    classification: 'review',
    reason: 'Contiene historial no clasificado',
    aheadBy: null,
    behindBy: null,
    deleted: false,
    deleteError: null,
    deleteSkipped: null
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

  try {
    const comparison = await api(`/compare/main...${encodedRef(branch)}`);
    record.aheadBy = comparison.ahead_by;
    record.behindBy = comparison.behind_by;

    if (comparison.ahead_by === 0) {
      record.classification = 'safe-delete';
      record.reason = 'No contiene commits únicos respecto de main';
    } else if (currentSha && mergedHeadShas.get(branch)?.has(currentSha)) {
      record.classification = 'safe-delete';
      record.reason = 'El Pull Request de esta misma punta fue fusionado hacia main y la rama no avanzó después';
    } else if (mergedHeadShas.has(branch)) {
      record.reason = `Tuvo un Pull Request fusionado hacia main, pero ahora contiene ${comparison.ahead_by} commit(s) únicos; requiere revisión manual`;
    } else {
      record.reason = `Contiene ${comparison.ahead_by} commit(s) no presentes en main`;
    }
  } catch (error) {
    record.classification = 'review';
    record.reason = `No se pudo comparar automáticamente: ${error.message}`;
  }
  records.push(record);
}

if (mode === 'delete') {
  const safeToDelete = records.filter(record => record.classification === 'safe-delete');
  for (const record of safeToDelete) {
    try {
      const currentRef = await api(`/git/ref/heads/${encodedRef(record.branch)}`);
      const liveSha = currentRef?.object?.sha || null;
      if (!liveSha || liveSha !== record.sha) {
        record.classification = 'review';
        record.reason = 'La rama cambió después de la auditoría; se omitió para evitar perder trabajo nuevo';
        record.deleteSkipped = 'branch-changed';
        continue;
      }
      await api(`/git/refs/heads/${encodedRef(record.branch)}`, { method: 'DELETE' });
      record.deleted = true;
    } catch (error) {
      record.classification = 'review';
      record.reason = `No se pudo eliminar de forma segura: ${error.message}`;
      record.deleteError = error.message;
    }
  }
}

const summary = createSummary(records);
await fs.writeFile(outputJson, `${JSON.stringify({ summary, records }, null, 2)}\n`);

const sections = [
  ['Conservar', 'keep'],
  ['Seguras para eliminar', 'safe-delete'],
  ['Revisión manual', 'review']
];
let markdown = '# Auditoría de ramas\n\n';
markdown += `- Repositorio: \`${repository}\`\n`;
markdown += `- Fecha: \`${summary.generatedAt}\`\n`;
markdown += `- Modo: \`${mode}\`\n`;
markdown += `- Total: **${summary.total}**\n`;
markdown += `- Conservar: **${summary.keep}**\n`;
markdown += `- Seguras para eliminar: **${summary.safeDelete}**\n`;
markdown += `- Revisión manual: **${summary.review}**\n`;
markdown += `- Eliminadas: **${summary.deleted}**\n`;
markdown += `- Omitidas por cambio concurrente: **${summary.deleteSkipped}**\n`;
markdown += `- Errores de eliminación: **${summary.deleteErrors}**\n\n`;

for (const [title, classification] of sections) {
  markdown += `## ${title}\n\n`;
  const matches = records.filter(record => record.classification === classification);
  if (matches.length === 0) {
    markdown += '_Ninguna._\n\n';
    continue;
  }
  for (const record of matches) {
    const statuses = [];
    if (record.deleted) statuses.push('eliminada');
    if (record.deleteSkipped) statuses.push(`omitida: ${record.deleteSkipped}`);
    if (record.deleteError) statuses.push(`error: ${record.deleteError}`);
    const status = statuses.length ? ` — ${statuses.join('; ')}` : '';
    markdown += `- \`${record.branch}\`${status}: ${record.reason}\n`;
  }
  markdown += '\n';
}

await fs.writeFile(outputMarkdown, markdown);
console.log(JSON.stringify(summary, null, 2));

if (mode === 'delete' && summary.deleteErrors > 0) {
  throw new Error(`La limpieza terminó con ${summary.deleteErrors} error(es); revisá los artefactos antes de reintentar`);
}
