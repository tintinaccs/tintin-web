import { checkProtectedFlows, flowFileHash } from './auditar-proteccion-flujos.mjs';

export const policyPath = 'config/proteccion-flujos.json';
export const planPath = 'config/mantenimiento-flujos-plan.json';
export const controlPath = path => path.startsWith('.github/workflows/') ||
  path === 'config/mantenimiento-flujos.json' || path === 'scripts/auditar-proteccion-flujos.mjs' ||
  path === 'scripts/mantenimiento-flujos-core.mjs' || path === 'scripts/mantenimiento-flujos-github.mjs' ||
  path === 'scripts/preparar-mantenimiento-flujos.mjs' || path === 'scripts/leer-blobs-mantenimiento.mjs';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw new Error(message); };

export function inspectMaintenance({ baseline, candidate, readFile, baseSha, plan, changedPaths }) {
  if (changedPaths.some(controlPath)) fail('Cambios al mecanismo de control requieren una migración separada.');
  const legacyErrors = checkProtectedFlows(baseline, candidate, readFile);
  if (!legacyErrors.length) return { maintenance: false, files: [], affectedRecords: [] };
  if (!/^[a-f0-9]{40}$/.test(baseSha)) fail('Base de mantenimiento inválida.');
  // Una renovación de código no renueva evidencia de producción ni alcances.
  const withoutFiles = policy => Object.fromEntries(Object.entries(policy).filter(([key]) => key !== 'files'));
  if (!equal(withoutFiles(baseline), withoutFiles(candidate))) fail('El mantenimiento no puede modificar registros, metadatos ni sellos.');
  if (!equal(Object.keys(baseline.files).sort(), Object.keys(candidate.files || {}).sort())) fail('El mantenimiento debe conservar todas las entradas protegidas.');
  const files = [];
  for (const [path, oldHash] of Object.entries(baseline.files)) {
    const newHash = flowFileHash(readFile(path));
    if (candidate.files[path] !== newHash) fail(`Huella candidata incorrecta: ${path}`);
    if (newHash !== oldHash) files.push({ path, oldHash, newHash });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (!files.length) fail('No existe una renovación válida de archivos protegidos.');
  const affectedRecords = Object.entries(baseline.records || {})
    .filter(([, paths]) => paths.some(path => files.some(file => file.path === path)))
    .map(([id]) => id).sort();
  if (!plan || plan.schemaVersion !== 1 || plan.baseCommit !== baseSha ||
      typeof plan.reason !== 'string' || plan.reason.trim().length < 20 || plan.reason.length > 2000 ||
      !equal(Object.keys(plan).sort(), ['affectedRecords', 'baseCommit', 'files', 'reason', 'schemaVersion'].sort()) ||
      !equal(plan.files, files) || !equal(plan.affectedRecords, affectedRecords)) {
    fail('Plan ausente, incompleto o distinto de la base, archivos y registros reales.');
  }
  return { maintenance: true, files, affectedRecords, reason: plan.reason };
}

export function validateAutomaticPullRequest(pr, config) {
  if (pr.draft || pr.user?.type !== 'User' ||
      !config.automaticMergeAuthorIds.includes(pr.user.id) ||
      pr.head?.repo?.full_name !== config.repository) {
    fail('Publicación automática limitada a PR propios del titular, sin borradores ni forks.');
  }
}

export function validateChecks(checks, config, headSha) {
  for (const requirement of config.requiredChecks) {
    const matches = checks.filter(check => check.name === requirement.name && check.app?.id === requirement.appId)
      .sort((a, b) => b.id - a.id);
    const check = matches[0];
    if (!check || check.head_sha !== headSha || check.status !== 'completed' || check.conclusion !== 'success' ||
        (requirement.workflowPath && check.workflowPath !== requirement.workflowPath) ||
        (requirement.workflowEvent && check.workflowEvent !== requirement.workflowEvent)) {
      fail(`CI obligatorio ausente, pendiente o fallido: ${requirement.name}`);
    }
  }
}

export function validateSnapshot(pr, mainSha, baseSha, headSha, config) {
  if (pr.state !== 'open' || pr.base?.repo?.full_name !== config.repository ||
      pr.base?.ref !== config.branch || pr.base?.sha !== baseSha || mainSha !== baseSha ||
      pr.head?.sha !== headSha) fail('El PR o main cambiaron: se requiere actualizar la rama y volver a verificar.');
}
