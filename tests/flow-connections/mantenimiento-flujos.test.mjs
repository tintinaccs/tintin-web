import test from 'node:test';
import assert from 'node:assert/strict';
import { flowFileHash } from '../../scripts/auditar-proteccion-flujos.mjs';
import { inspectMaintenance, validateApproval, validateChecks, validateEnvironment, validateSnapshot } from '../../scripts/mantenimiento-flujos-core.mjs';

const baseSha = 'a'.repeat(40), headSha = 'b'.repeat(40);
const fixture = () => {
  const baseline = { schemaVersion: 1, verifiedAt: 'evidencia histórica', files: { 'js/a.js': flowFileHash('old'), 'js/b.js': flowFileHash('stable') }, records: { a: ['js/a.js'], both: ['js/a.js', 'js/b.js'] } };
  const candidate = structuredClone(baseline);
  candidate.files['js/a.js'] = flowFileHash('new');
  const plan = { schemaVersion: 1, baseCommit: baseSha, reason: 'Corregir un defecto comprobado con pruebas.', files: [{ path: 'js/a.js', oldHash: baseline.files['js/a.js'], newHash: candidate.files['js/a.js'] }], affectedRecords: ['a', 'both'] };
  return { baseline, candidate, plan, baseSha, changedPaths: ['js/a.js', 'config/proteccion-flujos.json'], readFile: path => ({ 'js/a.js': 'new', 'js/b.js': 'stable' })[path] };
};
const config = { environment: 'maintenance', repository: 'owner/repo', branch: 'main', reviewerIds: [123], requiredChecks: [{ name: 'audit', appId: 15368, workflowPath: '.github/workflows/audit.yml', workflowEvent: 'pull_request' }, { name: 'pages', appId: 85455 }] };
const environment = () => ({ name: 'maintenance', id: 789, can_admins_bypass: false, deployment_branch_policy: { protected_branches: true, custom_branch_policies: false }, protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { type: 'User', id: 123 } }] }] });
const approval = () => [{ state: 'approved', environments: [{ id: 789 }], user: { type: 'User', id: 123 } }];
const checks = () => config.requiredChecks.map((check, id) => ({ id: id + 1, name: check.name, app: { id: check.appId }, workflowPath: check.workflowPath, workflowEvent: check.workflowEvent, head_sha: headSha, status: 'completed', conclusion: 'success' }));
const pr = () => ({ state: 'open', base: { repo: { full_name: 'owner/repo' }, ref: 'main', sha: baseSha }, head: { sha: headSha } });

test('Plan exacto acepta mantenimiento sin renovar sellos ni modificar scopes', () => {
  const data = fixture(), before = JSON.stringify(data.baseline);
  assert.equal(inspectMaintenance(data).maintenance, true);
  assert.equal(JSON.stringify(data.baseline), before);
});
test('Cambios ajenos a protección siguen funcionando sin autorización de mantenimiento', () => {
  const data = fixture(); data.candidate = structuredClone(data.baseline);
  data.readFile = path => path === 'js/a.js' ? 'old' : 'stable'; delete data.plan;
  assert.equal(inspectMaintenance(data).maintenance, false);
});
for (const [name, mutate] of [
  ['plan ausente', data => { delete data.plan; }],
  ['base antigua', data => { data.plan.baseCommit = 'c'.repeat(40); }],
  ['archivo extra', data => { data.plan.files.push(data.plan.files[0]); }],
  ['archivo omitido', data => { data.plan.files = []; }],
  ['registro omitido', data => { data.plan.affectedRecords = ['a']; }],
  ['hash inventado', data => { data.candidate.files['js/a.js'] = 'f'.repeat(64); }],
  ['archivo protegido retirado', data => { delete data.candidate.files['js/b.js']; }],
  ['scope cambiado', data => { data.candidate.records.a = []; }],
  ['sello actualizado', data => { data.candidate.verifiedAt = 'nuevo PASS'; }],
  ['ruta fuera del plan', data => { data.readFile = () => 'other'; }],
  ['campo inesperado', data => { data.plan.approved = true; }],
  ['workflow nuevo', data => { data.changedPaths.push('.github/workflows/override.yml'); }],
  ['auditor modificado', data => { data.changedPaths.push('scripts/mantenimiento-flujos-core.mjs'); }],
  ['revisores modificados', data => { data.changedPaths.push('config/mantenimiento-flujos.json'); }],
]) test(`Rechaza ${name}`, () => { const data = fixture(); mutate(data); assert.throws(() => inspectMaintenance(data)); });

test('Admite únicamente el entorno configurado con revisión obligatoria y sin bypass', () => validateEnvironment(environment(), config));
for (const [name, mutate] of [
  ['bypass administrador', env => { env.can_admins_bypass = true; }],
  ['revisor diferente', env => { env.protection_rules[0].reviewers[0].reviewer.id = 456; }],
  ['equipo en lugar de usuario', env => { env.protection_rules[0].reviewers[0].type = 'Team'; }],
  ['sin revisores', env => { env.protection_rules = []; }],
  ['todas las ramas', env => { env.deployment_branch_policy = null; }],
]) test(`Entorno rechaza ${name}`, () => { const env = environment(); mutate(env); assert.throws(() => validateEnvironment(env, config)); });

test('Aprobación autentica usuario y entorno de esta ejecución', () => validateApproval(approval(), environment(), config));
for (const [name, mutate] of [
  ['usuario no autorizado', items => { items[0].user.id = 456; }],
  ['bot', items => { items[0].user.type = 'Bot'; }],
  ['otro entorno', items => { items[0].environments[0].id = 1; }],
  ['sin revisión', items => { items.length = 0; }],
  ['rechazo posterior', items => { items.push({ ...items[0], state: 'rejected' }); }],
]) test(`Aprobación rechaza ${name}`, () => { const items = approval(); mutate(items); assert.throws(() => validateApproval(items, environment(), config)); });

test('CI acepta todos los checks correctos del commit exacto', () => validateChecks(checks(), config, headSha));
for (const [name, mutate] of [
  ['SHA antiguo', items => { items[0].head_sha = baseSha; }],
  ['aplicación falsa', items => { items[0].app.id = 999; }],
  ['workflow falso', items => { items[0].workflowPath = '.github/workflows/fake.yml'; }],
  ['evento skipped de pull_request_target', items => { items[0].workflowEvent = 'pull_request_target'; }],
  ['pending', items => { items[0].status = 'in_progress'; }],
  ['failure', items => { items[0].conclusion = 'failure'; }],
  ['skipped', items => { items[0].conclusion = 'skipped'; }],
  ['nuevo reintento pendiente', items => { items.push({ ...items[0], id: 999, status: 'in_progress' }); }],
]) test(`CI rechaza ${name}`, () => { const items = checks(); mutate(items); assert.throws(() => validateChecks(items, config, headSha)); });

test('Snapshot acepta PR abierto y base/head exactos', () => validateSnapshot(pr(), baseSha, baseSha, headSha, config));
test('Avance de main invalida la aprobación anterior', () => assert.throws(() => validateSnapshot(pr(), 'c'.repeat(40), baseSha, headSha, config)));
test('Nuevo commit del PR invalida la aprobación anterior', () => { const item = pr(); item.head.sha = 'c'.repeat(40); assert.throws(() => validateSnapshot(item, baseSha, baseSha, headSha, config)); });
test('PR cerrado no puede producir éxito', () => { const item = pr(); item.state = 'closed'; assert.throws(() => validateSnapshot(item, baseSha, baseSha, headSha, config)); });
