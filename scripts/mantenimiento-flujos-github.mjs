import fs from 'node:fs';
import { readTrustedOrRemote, githubFailure } from './leer-blobs-mantenimiento.mjs';
import { execFileSync } from 'node:child_process';
import { inspectMaintenance, validateApproval, validateChecks, validateEnvironment, validateSnapshot, policyPath, planPath } from './mantenimiento-flujos-core.mjs';

// Este programa sólo se ejecuta desde el checkout confiable de main.
// El árbol candidato se lee como JSON y blobs; nunca se ejecuta su código.
const config = JSON.parse(fs.readFileSync('config/mantenimiento-flujos.json', 'utf8'));
const mode = process.argv[2];
const headSha = process.env.CANDIDATE_SHA || '';
const prNumber = process.env.PR_NUMBER || '';
const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const runId = process.env.GITHUB_RUN_ID;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const api = async (path, body) => {
  const response = await fetch(`https://api.github.com/repos/${config.repository}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GH_TOKEN || ''}`, 'content-type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, githubFailure(path, response));
  return response.json();
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
  return inspectMaintenance({ baseline, candidate, baseSha, changedPaths, plan, readFile: path => {
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
  validateChecks(verified, config, headSha);
};

assert(['inspect', 'publish'].includes(mode), 'Modo inválido.');
assert(/^[a-f0-9]{40}$/.test(headSha) && /^[1-9][0-9]*$/.test(prNumber), 'PR y SHA completo obligatorios.');
assert(process.env.GITHUB_REPOSITORY === config.repository && process.env.GITHUB_REF === `refs/heads/${config.branch}`, 'Workflow fuera de main confiable.');
let conclusion = 'failure';
let message;
try {
  const result = await readCandidate();
  if (result.maintenance) {
    // La ejecución automática falla con instrucciones; sólo dispatch desde
    // main puede abrir una solicitud de revisión, después de pasar el CI.
    assert(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'Cambios protegidos: ejecutar mantenimiento desde main con este PR y SHA, después del CI.');
    assert(process.env.GITHUB_RUN_ATTEMPT === '1', 'Reintento inválido: lanzar un nuevo dispatch para obtener nueva aprobación.');
    await checkCI();
    const environment = await api(`environments/${config.environment}`);
    validateEnvironment(environment, config);
    if (mode === 'publish') {
      assert(process.env.APPROVAL_RESULT === 'success', 'La aprobación del entorno no se completó.');
      assert(/^[1-9][0-9]*$/.test(runId || ''), 'Ejecución inválida.');
      // No se heredan revisiones al reejecutar un run antiguo.
      validateApproval(await api(`actions/runs/${runId}/approvals`), environment, config);
    }
  }
  await snapshot();
  if (mode === 'inspect') {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `maintenance=${result.maintenance}\nbase_sha=${baseSha}\nhead_sha=${headSha}\n`);
    // Escapar contenido candidato para que el resumen no permita HTML ni
    // instrucciones disfrazadas como UI de aprobación.
    const escape = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `<h2>Revisión de mantenimiento — PR ${prNumber}</h2><p>Base: <code>${baseSha}</code><br>Candidato: <code>${headSha}</code></p><pre>${escape(JSON.stringify(result, null, 2))}</pre>\n`);
  }
  conclusion = 'success';
  message = result.maintenance ? (mode === 'publish' ? 'Plan exacto, CI y aprobación del entorno verificados para este commit.' : 'Plan y CI verificados; falta revisión del entorno antes del veredicto.') : 'Todos los archivos y alcances protegidos permanecen intactos.';
} catch (error) { message = error.message; process.exitCode = 1; }
if (mode === 'publish') {
  await api('check-runs', {
    name: config.checkName, head_sha: headSha, status: 'completed', conclusion,
    details_url: `https://github.com/${config.repository}/actions/runs/${runId}`,
    output: { title: conclusion === 'success' ? 'Protección verificada' : 'Protección bloqueada', summary: message },
  });
}
console.log(message);
