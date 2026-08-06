import fs from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const workflowRef = process.env.GITHUB_REF_NAME || '';
const mode = process.env.BRANCH_CLEANUP_MODE || 'audit';
const confirmation = process.env.BRANCH_CLEANUP_CONFIRMATION || '';
const outputJson = process.env.BRANCH_AUDIT_JSON || 'branch-audit.json';
const outputMarkdown = process.env.BRANCH_AUDIT_MARKDOWN || 'branch-audit.md';

const branchName = (...parts) => parts.join('');
const reviewedObsoleteBranches = new Map([
  ['agent/phase8-tree-test', {
    sha: '428ed951993244a0b31ad4b5fcbfe4923519c144',
    reason: 'Rama temporal con archivos y workflows de prueba de árbol'
  }],
  [branchName('chat', 'gpt/global-hardening-20260707'), {
    sha: 'da6d89074337708de370695a898f2a2f51e8a9dc',
    reason: 'Trabajo antiguo superado por la reorganización y auditoría integral actual'
  }],
  ['chore/cierre-maestro-ramas', {
    sha: 'e675da2422c94eb3382ebad206a6fd536c4e0173',
    reason: 'Rama reemplazada por el Pull Request #343; su diferencia residual era un comentario sin efecto funcional'
  }],
  ['chore/cierre-maestro-ramas-v2', {
    sha: 'e675da2422c94eb3382ebad206a6fd536c4e0173',
    reason: 'Duplicado exacto de la rama reemplazada por el Pull Request #343'
  }],
  [branchName('clau', 'de/user-mgmt-bulk-organize-sf4tqu'), {
    sha: 'b3b854c65798c296eaf5c457fde54da8c3f662fa',
    reason: 'Duplicado de una implementación monolítica antigua de usuarios y colecciones ya reemplazada'
  }],
  ['diagnostic/prod-cls-verification-20260806', {
    sha: '58773f95fd2fc2045ae44f2a59a77f8b1649e93f',
    reason: 'Diagnóstico temporal de CLS ya incorporado y validado en main'
  }],
  ['feature/firebase-web-push', {
    sha: 'ae34f88ac55b7cee80548c474e1120395fe73c48',
    reason: 'Duplicado exacto de la rama conservada por el Pull Request abierto #320'
  }],
  ['fix/catalog-stock-priority-realtime', {
    sha: '06d9f2d2927bb0ed0632d5593e2305be43f0056f',
    reason: 'Cambio antiguo de catálogo superado por el estado comercial y las auditorías actuales'
  }],
  ['fix/hide-cookie-banner-superadmin', {
    sha: 'c4e553b4c141f07cd8590ad4bc6efd2662865946',
    reason: 'Corrección antigua de privacidad absorbida por el runtime y el panel actuales'
  }],
  ['fix/loader-logo-oficial-instantaneo-20260731', {
    sha: '5a27cc9a18b193814b3df9c08c6e934fdd252f0a',
    reason: 'Variación antigua del loader y caché sustituida por el sistema actual auditado'
  }],
  ['fix/phase8-users-audit-permissions', {
    sha: 'c63bafe7df04dd4775de9e4a7e5b7f3d4df1175a',
    reason: 'Implementación antigua de roles sustituida por la arquitectura modular y sus pruebas actuales'
  }],
  ['fix/reactivate-analytics-throttle', {
    sha: '935463cc3ed90a44b90b63abaab51b1be4ddb993',
    reason: 'Throttle de analítica ya incorporado en las reglas actuales'
  }],
  ['refactor/integrar-cierre-nombres-global', {
    sha: '99020f14724df88ac24561c6000c103ef3644ecf',
    reason: 'Rama de integración temporal cuyo resultado final ya fue fusionado'
  }],
  ['temp/noop-test', {
    sha: 'd0eed4ea5499bbde4920f4d2039e8139ff623cd8',
    reason: 'Rama temporal de regeneración: la prueba SEO y el manifiesto quedaron reemplazados por el cierre fusionado #314'
  }],
  ['tmp/admin-cls-rebase-20260806', {
    sha: '1328a51a670138bb8a437bd19e62d31e7410dd9a',
    reason: 'Rebase temporal de CLS cuyos marcadores están incorporados en main por el cierre #319'
  }]
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

function encodedBranch(branch) {
  return encodeURIComponent(branch);
}

function isBackupBranch(branch) {
  return branch.startsWith('backup/') || branch === 'backup-before-fixes-20260715';
}

function isPermanentBranch(branchInfo, openHeads, defaultBranch) {
  const branch = branchInfo.name;
  return branch === defaultBranch
    || branchInfo.protected === true
    || isBackupBranch(branch)
    || openHeads.has(branch);
}

function internalOpenPulls(pulls, branch) {
  return pulls.filter(pr => pr.head?.repo?.full_name === repository && pr.head?.ref === branch);
}

const [repositoryInfo, branches, openPulls, closedPulls] = await Promise.all([
  api(''),
  paginate('/branches'),
  paginate('/pulls?state=open'),
  paginate('/pulls?state=closed&sort=updated&direction=desc')
]);

const defaultBranch = repositoryInfo.default_branch || 'main';
if (mode === 'delete' && workflowRef !== defaultBranch) {
  throw new Error(`La eliminación solo puede ejecutarse desde la rama principal ${defaultBranch}`);
}

const openHeads = new Set(
  openPulls
    .filter(pr => pr.head?.repo?.full_name === repository)
    .map(pr => pr.head?.ref)
    .filter(Boolean)
);

const mergedHeadShas = new Map();
for (const pr of closedPulls) {
  if (!pr.merged_at || pr.head?.repo?.full_name !== repository || !pr.head?.ref || !pr.head?.sha) continue;
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
    protected: branchInfo.protected === true,
    classification: 'review',
    reason: 'Contiene historial no clasificado',
    aheadBy: null,
    behindBy: null,
    deleted: false
  };

  if (isPermanentBranch(branchInfo, openHeads, defaultBranch)) {
    record.classification = 'keep';
    record.reason = branch === defaultBranch
      ? 'Rama principal'
      : branchInfo.protected === true
        ? 'Rama protegida por GitHub'
        : isBackupBranch(branch)
          ? 'Rama de respaldo'
          : 'Rama vinculada a un Pull Request abierto';
    records.push(record);
    continue;
  }

  const reviewedObsolete = reviewedObsoleteBranches.get(branch);
  if (reviewedObsolete) {
    if (currentSha === reviewedObsolete.sha) {
      record.classification = 'safe-delete';
      record.reason = reviewedObsolete.reason;
    } else {
      record.reason = `La rama cambió desde la revisión (${reviewedObsolete.sha} → ${currentSha || 'sin SHA'}); requiere revisión manual`;
    }
    records.push(record);
    continue;
  }

  try {
    const comparison = await api(`/compare/${encodedRef(defaultBranch)}...${encodedRef(branch)}`);
    record.aheadBy = comparison.ahead_by;
    record.behindBy = comparison.behind_by;

    if (comparison.ahead_by === 0) {
      record.classification = 'safe-delete';
      record.reason = `No contiene commits únicos respecto de ${defaultBranch}`;
    } else if (currentSha && mergedHeadShas.get(branch)?.has(currentSha)) {
      record.classification = 'safe-delete';
      record.reason = 'El Pull Request de esta misma punta fue fusionado y la rama no avanzó después';
    } else if (mergedHeadShas.has(branch)) {
      record.reason = `Tuvo un Pull Request fusionado, pero ahora contiene ${comparison.ahead_by} commit(s) únicos; requiere revisión manual`;
    } else {
      record.reason = `Contiene ${comparison.ahead_by} commit(s) no presentes en ${defaultBranch}`;
    }
  } catch (error) {
    record.classification = 'review';
    record.reason = `No se pudo comparar automáticamente: ${error.message}`;
  }
  records.push(record);
}

const deleteCandidates = records.filter(record => record.classification === 'safe-delete' && !record.protected);
if (mode === 'delete') {
  for (const record of deleteCandidates) {
    try {
      const headFilter = encodeURIComponent(`${owner}:${record.branch}`);
      const [freshBranch, freshPulls] = await Promise.all([
        api(`/branches/${encodedBranch(record.branch)}`),
        paginate(`/pulls?state=open&head=${headFilter}`)
      ]);
      const freshSha = freshBranch.commit?.sha || null;
      const freshInternalPulls = internalOpenPulls(freshPulls, record.branch);

      if (freshBranch.protected === true) {
        record.classification = 'review';
        record.protected = true;
        record.reason = 'La rama quedó protegida después del informe; no se eliminó';
        continue;
      }
      if (freshSha !== record.sha) {
        record.classification = 'review';
        record.reason = `La rama avanzó después del informe (${record.sha || 'sin SHA'} → ${freshSha || 'sin SHA'}); no se eliminó`;
        continue;
      }
      if (freshInternalPulls.length > 0) {
        record.classification = 'keep';
        record.reason = 'Se abrió un Pull Request después del informe; la rama se conserva';
        continue;
      }

      await api(`/git/refs/heads/${encodedRef(record.branch)}`, { method: 'DELETE' });
      record.deleted = true;
    } catch (error) {
      record.classification = 'review';
      record.reason = `No se pudo revalidar o eliminar con seguridad: ${error.message}`;
    }
  }
}

const safeToDelete = records.filter(record => record.classification === 'safe-delete' && !record.protected);
const summary = {
  generatedAt: new Date().toISOString(),
  repository,
  defaultBranch,
  workflowRef,
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
let markdown = '# Auditoría de ramas\n\n';
markdown += `- Repositorio: \`${repository}\`\n`;
markdown += `- Rama principal: \`${defaultBranch}\`\n`;
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
