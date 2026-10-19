import fs from 'node:fs';
import { readTrustedOrRemote, githubFailure } from './leer-blobs-mantenimiento.mjs';
import { execFileSync } from 'node:child_process';
import { inspectMaintenance, validateAutomaticPullRequest, validateChecks, validateSnapshot, policyPath, planPath } from './mantenimiento-flujos-core.mjs';

// Este programa sólo se ejecuta desde el checkout confiable de main.
// El árbol candidato se lee como JSON y blobs; nunca se ejecuta su código.
const config = JSON.parse(fs.readFileSync('config/mantenimiento-flujos.json', 'utf8'));
const mode = process.argv[2];
let headSha = process.env.CANDIDATE_SHA || '';
let prNumber = process.env.PR_NUMBER || '';
const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runId = process.env.GITHUB_RUN_ID;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const api = async (path, body, method = body ? 'POST' : 'GET') => {
  const response = await fetch(`https://api.github.com/repos/${config.repository}/${path}`, {
    method,
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GH_TOKEN || ''}`, 'content-type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, githubFailure(path, response));
  return response.status === 204 ? null : response.json();
};
const list = async (path, key) => {
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const data = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = key ? data[key] : data;
    assert(Array.isArray(batch), 'Respuesta paginada inválida.');
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error('Respuesta paginada excede el límite seguro.');
};
const snapshot = async () => {
  const pr = await api(`pulls/${prNumber}`);
  const main = await api(`git/ref/heads/${config.branch}`);
  validateSnapshot(pr, main.object.sha, baseSha, headSha, config);
  validateAutomaticPullRequest(pr, config);
  return pr;
};
const readCandidate = async () => {
  await snapshot();
  const baseline = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const [tree, baseTree] = await Promise.all([api(`git/trees/${headSha}?recursive=1`), api(`git/trees/${baseSha}?recursive=1`)]);
  assert(!tree.truncated && !baseTree.truncated, 'Árbol incompleto.');
  const blobs = new Map(tree.tree.filter(item => item.type === 'blob').map(item => [item.path, item]));
  const original = new Map(baseTree.tree.filter(item => item.type === 'blob').map(item => [item.path, item]));
  const changedPaths = [...new Set([...blobs.keys(), ...original.keys()])].filter(path =>
    blobs.get(path)?.sha !== original.get(path)?.sha || blobs.get(path)?.mode !== original.get(path)?.mode);
  const bytes = new Map();
  const read = async path => {
    if (bytes.has(path)) return;
    const entry = blobs.get(path);
    assert(entry?.mode === '100644' || entry?.mode === '100755', `Archivo ausente o no regular: ${path}`);
    bytes.set(path, await readTrustedOrRemote(entry, original.get(path),
      () => fs.readFileSync(path), async () => {
        const blob = await api(`git/blobs/${entry.sha}`);
        assert(blob.encoding === 'base64' && blob.size <= 5 * 1024 * 1024, 'Blob inválido o demasiado grande.');
        return Buffer.from(blob.content, 'base64');
      }));
  };
  await read(policyPath);
  const candidate = JSON.parse(bytes.get(policyPath).toString('utf8'));
  const paths = [...new Set([...Object.keys(baseline.files), ...Object.keys(candidate.files || {})])];
  assert(paths.length <= 1000, 'Demasiados archivos protegidos.');
  for (let i = 0; i < paths.length; i += 8) await Promise.all(paths.slice(i, i + 8).map(read));
  let plan;
  if (blobs.has(planPath)) {
    await read(planPath);
    assert(bytes.get(planPath).length <= 65536, 'Plan demasiado grande.');
    plan = JSON.parse(bytes.get(planPath).toString('utf8'));
  }
  return inspectMaintenance({ baseline, candidate, baseSha, changedPaths, plan, allowControlUpdates: config.automaticControlMaintenance === true, readFile: path => {
    assert(bytes.has(path), `Archivo no leído: ${path}`); return bytes.get(path);
  } });
};
const checkCI = async () => {
  const checks = await list(`commits/${headSha}/check-runs?filter=latest`, 'check_runs');
  const runs = new Map();
  const verified = [];
  for (const requirement of config.requiredChecks.filter(check => check.workflowPath)) {
    for (const check of checks.filter(item => item.name === requirement.name && item.app?.id === requirement.appId)) {
      const match = check.details_url?.match(/^https:\/\/github\.com\/tintinaccs\/tintin-web\/actions\/runs\/([0-9]+)\/job\/[0-9]+$/);
      if (!match) continue;
      if (!runs.has(match[1])) runs.set(match[1], await api(`actions/runs/${match[1]}`));
      const run = runs.get(match[1]);
      // Excluir el job skipped del evento pull_request_target; la auditoría
      // real se ejecuta en pull_request y debe identificar este mismo SHA/PR.
      if (run.path !== requirement.workflowPath || run.event !== requirement.workflowEvent) continue;
      assert(run.head_repository?.full_name === config.repository &&
        (run.head_sha === headSha || run.pull_requests?.some(pr => pr.number === Number(prNumber) && pr.head?.sha === headSha)), 'CI corresponde a otro candidato.');
      verified.push({ ...check, workflowPath: run.path, workflowEvent: run.event });
    }
  }
  verified.push(...checks.filter(check => config.requiredChecks.some(item => !item.workflowPath && item.name === check.name && item.appId === check.app?.id)));
  return verified;
};

assert(mode === 'automatic', 'Modo inválido.');
assert(process.env.GITHUB_REPOSITORY === config.repository && process.env.GITHUB_REF === `refs/heads/${config.branch}`, 'Workflow fuera de main confiable.');
assert(['workflow_run', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME), 'Evento no autorizado.');

// Un workflow_run puede repetir la validación tras reintentar CI. Ignorar
// candidatos antiguos/cerrados; nunca publicar éxito para otra cabeza del PR.
if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const run = event.workflow_run;
  assert(run?.path === '.github/workflows/auditar-tintin.yml' && run.event === 'pull_request' &&
    run.head_repository?.full_name === config.repository, 'Evento CI ajeno al repositorio o workflow esperado.');
  const candidates = await list(`commits/${run.head_sha}/pulls`);
  const pr = candidates.find(item => item.state === 'open' && item.base?.ref === config.branch && item.head?.sha === run.head_sha);
  if (!pr) { console.log('La ejecución ya no corresponde a un PR abierto vigente.'); process.exit(0); }
  prNumber = String(pr.number); headSha = pr.head.sha;
}
assert(/^[a-f0-9]{40}$/.test(headSha) && /^[1-9][0-9]*$/.test(prNumber), 'PR y SHA completo obligatorios.');
assert(Number.isSafeInteger(config.waitMinutes) && config.waitMinutes > 0 && config.waitMinutes <= 80, 'Plazo de CI inválido.');
assert(config.mergeMethod === 'squash', 'Método de integración no autorizado.');
const checks = [];
const checkNames = [config.checkName, 'Protected flow integrity'];
const details = `https://github.com/${config.repository}/actions/runs/${runId}`;
const report = async (conclusion, message) => {
  for (const check of checks) await api(`check-runs/${check.id}`, {
    status: 'completed', conclusion, output: { title: conclusion === 'success' ? 'Validación automática aprobada' : 'Publicación bloqueada', summary: message },
  }, 'PATCH');
};
try {
  await snapshot();
  await readCandidate();
  for (const name of checkNames) checks.push(await api('check-runs', {
    name, head_sha: headSha, status: 'in_progress', details_url: details,
    output: { title: 'Esperando pruebas obligatorias', summary: 'Se verifican plan, archivos, base y CI del commit exacto antes de integrar.' },
  }));
  const deadline = Date.now() + config.waitMinutes * 60_000;
  while (true) {
    await snapshot();
    const verified = await checkCI();
    try { validateChecks(verified, config, headSha); break; }
    catch (error) {
      const failed = config.requiredChecks.some(requirement => {
        const latest = verified.filter(check => check.name === requirement.name && check.app?.id === requirement.appId)
          .sort((a, b) => b.id - a.id)[0];
        return latest?.status === 'completed' && latest.conclusion !== 'success';
      });
      assert(!failed, error.message);
      assert(Date.now() < deadline, `Se agotó la espera: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 20_000));
    }
  }
  // Releer todos los datos después de la espera: ningún snapshot previo autoriza el merge.
  await readCandidate();
  validateChecks(await checkCI(), config, headSha);
  await snapshot();
  await report('success', 'Plan exacto, hashes reales, alcances y CI del commit verificados automáticamente.');
  const merged = await api(`pulls/${prNumber}/merge`, { sha: headSha, merge_method: config.mergeMethod }, 'PUT');
  assert(merged.merged === true && /^[a-f0-9]{40}$/.test(merged.sha || ''), 'GitHub no confirmó la integración.');
  console.log(`PR ${prNumber} integrado: ${merged.sha}`);
  // Los pushes con GITHUB_TOKEN no disparan Actions. Los dispatch explícitos
  // sí lo hacen: mantener auditoría de main y comprobación del deploy real.
  for (const workflow of ['auditar-tintin.yml', 'monitor-produccion.yml']) {
    await api(`actions/workflows/${workflow}/dispatches`, {
      ref: config.branch,
      ...(workflow === 'monitor-produccion.yml' ? { inputs: { verification_only: true } } : {}),
    });
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `PR #${prNumber}: ${headSha} → ${merged.sha}. CI y plan verificados; auditoría de main y verificación de producción iniciadas.\n`);
  }
} catch (error) {
  if (checks.length) await report('failure', error.message);
  console.error(error.message); process.exitCode = 1;
}
