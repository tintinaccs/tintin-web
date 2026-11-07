import { checkProtectedFlows, flowFileHash } from './auditar-proteccion-flujos.mjs';

export const policyPath = 'config/proteccion-flujos.json';
export const planPath = 'config/mantenimiento-flujos-plan.json';
export const controlPath = path => path.startsWith('.github/workflows/') ||
  path === 'config/mantenimiento-flujos.json' || path === 'scripts/auditar-proteccion-flujos.mjs' ||
  path === 'scripts/mantenimiento-flujos-core.mjs' || path === 'scripts/mantenimiento-flujos-github.mjs' ||
  path === 'scripts/preparar-mantenimiento-flujos.mjs' || path === 'scripts/leer-blobs-mantenimiento.mjs';
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw new Error(message); };

export function inspectMaintenance({ baseline, candidate, readFile, baseSha, plan, changedPaths, allowControlUpdates = false }) {
  if (!allowControlUpdates && changedPaths.some(controlPath)) fail('Cambios al mecanismo de control requieren autorización en la configuración confiable de main.');
  const legacyErrors = checkProtectedFlows(baseline, candidate, readFile);
  if (!legacyErrors.length) return { maintenance: false, files: [], removedFiles: [], affectedRecords: [] };
  if (!/^[a-f0-9]{40}$/.test(baseSha)) fail('Base de mantenimiento inválida.');
  // Una renovación de código no renueva evidencia de producción ni alcances.
  const withoutFiles = policy => Object.fromEntries(Object.entries(policy).filter(([key]) => key !== 'files'));
  if (!equal(withoutFiles(baseline), withoutFiles(candidate))) fail('El mantenimiento no puede modificar registros, metadatos ni sellos.');
  // Un archivo protegido ausente se retira solo con plan explícito, sin alcances
  // de registro y conservando las demás entradas; nunca por simple omisión.
  const files = [], removedFiles = [];
  for (const [path, oldHash] of Object.entries(baseline.files)) {
    let bytes;
    try { bytes = readFile(path); } catch { removedFiles.push({ path, oldHash }); continue; }
    const newHash = flowFileHash(bytes);
    if (candidate.files?.[path] !== newHash) fail(`Huella candidata incorrecta: ${path}`);
    if (newHash !== oldHash) files.push({ path, oldHash, newHash });
  }
  const kept = Object.keys(baseline.files).filter(path => !removedFiles.some(file => file.path === path));
  if (!equal(kept.sort(), Object.keys(candidate.files || {}).sort())) fail('El mantenimiento debe conservar todas las entradas protegidas no retiradas.');
  for (const { path } of removedFiles) {
    if (Object.values(baseline.records || {}).some(paths => paths.includes(path))) fail(`No se puede retirar un archivo con alcance de registro: ${path}`);
  }
  const byPath = (x, y) => x.path.localeCompare(y.path, 'en');
  files.sort(byPath); removedFiles.sort(byPath);
  if (!files.length && !removedFiles.length) fail('No existe una renovación válida de archivos protegidos.');
  const affectedRecords = Object.entries(baseline.records || {})
    .filter(([, paths]) => paths.some(path => files.some(file => file.path === path)))
    .map(([id]) => id).sort();
  const planKeys = ['affectedRecords', 'baseCommit', 'files', 'reason', 'schemaVersion', ...(removedFiles.length ? ['removedFiles'] : [])].sort();
  if (!plan || plan.schemaVersion !== 1 || plan.baseCommit !== baseSha ||
      typeof plan.reason !== 'string' || plan.reason.trim().length < 20 || plan.reason.length > 2000 ||
      !equal(Object.keys(plan).sort(), planKeys) ||
      !equal(plan.files, files) || !equal(plan.affectedRecords, affectedRecords) ||
      (removedFiles.length && !equal(plan.removedFiles, removedFiles))) {
    fail('Plan ausente, incompleto o distinto de la base, archivos y registros reales.');
  }
  return { maintenance: true, files, removedFiles, affectedRecords, reason: plan.reason };
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
