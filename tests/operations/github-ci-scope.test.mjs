import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../scripts/verificar-salud-ci-global.mjs', import.meta.url), 'utf8');
const conclusions = source.slice(source.indexOf('const blockingConclusions ='), source.indexOf('function ensureDir('));
const logic = source.slice(source.indexOf('function isCurrentMasterCheck('), source.indexOf('async function verifyGlobalCi('));
const sha = 'a'.repeat(40), repo = 'tintinaccs/tintin-web', current = 100;
const run = (id, values = {}) => ({id, workflow_id: 10, name: 'Diagnóstico Maestro Tintin',
  path: '.github/workflows/diagnostico-maestro.yml', event: 'workflow_dispatch',
  head_sha: sha, head_branch: 'main', head_repository: {full_name: repo},
  status: 'completed', conclusion: 'failure', ...values});
const control = values => run(200, {workflow_id: 20, name: 'Mantenimiento',
  path: '.github/workflows/auditoria-dependencias.yml', event: 'workflow_run', ...values});
const check = (id, values = {}) => ({id, name: 'Validar y publicar automáticamente', head_sha: sha,
  details_url: `https://github.com/${repo}/actions/runs/${id}/job/123`,
  status: 'completed', conclusion: 'failure', ...values});

async function snapshot({runs = [], checks = [], own = true} = {}) {
  const c = vm.createContext({repo, sha, currentRunId: current, URL, Set, waitSeconds: 0,
    githubApi: async endpoint => {
      if (endpoint.includes('/actions/runs?')) return {workflow_runs: [...(own ? [run(current, {status:'in_progress',conclusion:null})] : []), ...runs]};
      if (endpoint.includes('/check-runs?')) return {check_runs: checks};
      if (endpoint.includes('/check-suites?')) return {check_suites: []};
      return [];
    }});
  vm.runInContext(conclusions + logic, c);
  return {state: await c.collectState(), render: c.renderEvidence};
}
const ids = items => Array.from(items, item => item.id);

test('un control de otro PR y un Maestro anterior no contaminan el commit; se conservan en evidencia', async () => {
  const {state, render} = await snapshot({runs: [run(99), control()], checks: [check(99),check(200),check(current)]});
  assert.deepEqual(ids(state.failedWorkflowRuns), []);
  assert.deepEqual(ids(state.failedCheckRuns), []);
  assert.deepEqual(ids(state.pendingWorkflowRuns), []);
  assert.deepEqual(ids(state.ignoredWorkflowRuns), [100,99,200]);
  assert.deepEqual(ids(state.ignoredCheckRuns), [99,200,100]);
  const report = render({...state,status:'PASS'});
  assert.match(report, /Mantenimiento \(200\): failure/);
  assert.match(report, /Diagnóstico anterior del mismo workflow/);
  assert.match(report, /checks de protección del candidato/);
});

for (const conclusion of ['failure','cancelled','timed_out','action_required']) {
  test(`CI real ${conclusion} sigue bloqueando aunque la automatización sea ajena al commit`, async () => {
    const artifact = run(300, {workflow_id:30,name:'Repository audit',path:'.github/workflows/auditar-tintin.yml',conclusion});
    const {state} = await snapshot({runs:[control(),artifact],checks:[check(200),check(300,{name:'Repository audit',conclusion})]});
    assert.deepEqual(ids(state.failedWorkflowRuns), [300]);
    assert.deepEqual(ids(state.failedCheckRuns), [300]);
  });
}

for (const event of ['schedule','workflow_dispatch']) {
  test(`auditoría de dependencias por ${event} conserva su fallo`, async () => {
    const {state} = await snapshot({runs:[control({event})],checks:[check(200,{name:'Dependencias npm'})]});
    assert.deepEqual(ids(state.failedWorkflowRuns), [200]);
    assert.deepEqual(ids(state.failedCheckRuns), [200]);
  });
}

test('los checks de protección asociados al candidato siguen bloqueando', async () => {
  const {state} = await snapshot({runs:[control({head_sha:'b'.repeat(40)})],checks:[check(200,{name:'Protected flow integrity'})]});
  assert.deepEqual(ids(state.failedCheckRuns), [200]);
  assert.deepEqual(ids(state.failedWorkflowRuns), [200]);
});

test('otro workflow_run y el mismo nombre bajo otro workflow no se excluyen', async () => {
  const {state} = await snapshot({runs:[control({path:'.github/workflows/otro.yml'}),run(99,{workflow_id:11})],checks:[check(200),check(99)]});
  assert.deepEqual(ids(state.failedWorkflowRuns), [200,99]);
  assert.deepEqual(ids(state.failedCheckRuns), [200,99]);
});

test('sin asociación comprobada al repositorio y SHA no se excluye un control', async () => {
  const {state} = await snapshot({runs:[control({head_repository:{full_name:'otro/repo'}})],checks:[check(200)]});
  assert.deepEqual(ids(state.failedWorkflowRuns), [200]);
  assert.deepEqual(ids(state.failedCheckRuns), [200]);
});

test('URL ajena y checks sin SHA no quedan ocultos por parecerse al enlace de un control', async () => {
  for (const values of [
    {details_url:'https://github.com.ejemplo.test/tintinaccs/tintin-web/actions/runs/200/job/123'},
    {details_url:'https://github.com/otro/repo/actions/runs/200/job/123'},
    {head_sha:undefined},
  ]) {
    const {state} = await snapshot({runs:[control()],checks:[check(200,values)]});
    assert.deepEqual(ids(state.failedCheckRuns), [200]);
  }
});

test('si falta metadata del diagnóstico actual, otro Maestro fallido sigue visible', async () => {
  const {state} = await snapshot({own:false,runs:[run(99)],checks:[check(99)]});
  assert.deepEqual(ids(state.failedWorkflowRuns), [99]);
  assert.deepEqual(ids(state.failedCheckRuns), [99]);
});

test('una comprobación real pendiente conserva la espera', async () => {
  const {state} = await snapshot({runs:[control()],checks:[check(300,{name:'Repository audit',status:'in_progress',conclusion:null})]});
  assert.deepEqual(ids(state.pendingCheckRuns), [300]);
});
