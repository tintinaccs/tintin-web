import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(root, 'scripts', 'auditar-limpiar-ramas.mjs');
const branch = (name, sha, protectedBranch = false) => ({ name, protected: protectedBranch, commit: { sha } });
const branches = [
  branch('main', 'mainsha', true), branch('release/stable', 'relsha', true), branch('backup/weekly', 'backsha'),
  branch('feature/open', 'opensha'), branch('feature/no-unique', 'nusha'), branch('feature/merged', 'mergedsha'),
  branch('feature/merged-develop', 'developsha'), branch('feature/unique', 'uniqsha'),
  branch('temp/noop-test', 'd0eed4ea5499bbde4920f4d2039e8139ff623cd8'),
  branch('tmp/admin-cls-rebase-20260806', '1328a51a670138bb8a437bd19e62d31e7410dd9a')
];
const deletableBranches = branches.filter(item => !['feature/unique', 'feature/merged-develop'].includes(item.name));

const openPulls = [{ head: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: 'feature/open', sha: 'opensha' } }];
const closedPulls = [
  {
    merged_at: '2026-08-06T00:00:00Z',
    base: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: 'main' },
    head: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: 'feature/merged', sha: 'mergedsha' }
  },
  {
    merged_at: '2026-08-06T00:00:00Z',
    base: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: 'develop' },
    head: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: 'feature/merged-develop', sha: 'developsha' }
  }
];
const comparisons = {
  'main...feature/no-unique': { ahead_by: 0, behind_by: 2 },
  'main...feature/merged': { ahead_by: 1, behind_by: 0 },
  'main...feature/merged-develop': { ahead_by: 1, behind_by: 0 },
  'main...feature/unique': { ahead_by: 3, behind_by: 0 }
};
const mockFetchSource = `
import { appendFileSync } from 'node:fs';
const branches = JSON.parse(process.env.MOCK_BRANCHES);
const liveBranches = JSON.parse(process.env.MOCK_LIVE_BRANCHES);
const openPulls = JSON.parse(process.env.MOCK_OPEN_PULLS);
const liveOpenPullBranches = new Set(JSON.parse(process.env.MOCK_LIVE_OPEN_PULL_BRANCHES));
const closedPulls = JSON.parse(process.env.MOCK_CLOSED_PULLS);
const comparisons = JSON.parse(process.env.MOCK_COMPARISONS);
function json(data, status = 200) { return new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); }
globalThis.fetch = async (url, options = {}) => {
  const value = String(url); const method = options.method || 'GET';
  if (method === 'DELETE') { appendFileSync(process.env.MOCK_DELETE_LOG, value + '\\n'); return json(null, 204); }
  if (value.endsWith('/repos/tintinaccs/tintin-web')) return json({ default_branch: 'main' });
  if (value.includes('/branches?')) return json(branches);
  if (value.includes('/branches/')) { const encoded = value.split('/branches/')[1].split('?')[0]; const name = decodeURIComponent(encoded); const current = liveBranches.find(item => item.name === name); return current ? json(current) : json({ message: 'Not Found' }, 404); }
  if (value.includes('/pulls?state=open&head=')) { const parsed = new URL(value); const head = parsed.searchParams.get('head') || ''; const name = head.split(':').slice(1).join(':'); return json(liveOpenPullBranches.has(name) ? [{ head: { repo: { full_name: 'tintinaccs/tintin-web' }, ref: name } }] : []); }
  if (value.includes('/pulls?state=open')) return json(openPulls);
  if (value.includes('/pulls?state=closed')) return json(closedPulls);
  for (const [key, result] of Object.entries(comparisons)) if (value.includes('/compare/' + key)) return json(result);
  throw new Error('URL no simulada: ' + value);
};`;
async function runCase({ mode, ref, confirmation = '', branchSet = branches, liveBranchSet = branchSet, liveOpenPullBranches = [], requireZeroReview = false }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tintin-branch-audit-'));
  const mockFile = path.join(directory, 'mock-fetch.mjs'); const jsonFile = path.join(directory, 'branch-audit.json');
  const markdownFile = path.join(directory, 'branch-audit.md'); const deleteLog = path.join(directory, 'deleted.log');
  await writeFile(mockFile, mockFetchSource);
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(mockFile).href, script], { cwd: root, encoding: 'utf8', env: {
    ...process.env, GITHUB_TOKEN: 'test-token', GITHUB_REPOSITORY: 'tintinaccs/tintin-web', GITHUB_REF_NAME: ref,
    BRANCH_CLEANUP_MODE: mode, BRANCH_CLEANUP_CONFIRMATION: confirmation, BRANCH_AUDIT_REQUIRE_ZERO_REVIEW: String(requireZeroReview), BRANCH_AUDIT_JSON: jsonFile,
    BRANCH_AUDIT_MARKDOWN: markdownFile, MOCK_BRANCHES: JSON.stringify(branchSet), MOCK_LIVE_BRANCHES: JSON.stringify(liveBranchSet),
    MOCK_OPEN_PULLS: JSON.stringify(openPulls), MOCK_LIVE_OPEN_PULL_BRANCHES: JSON.stringify(liveOpenPullBranches),
    MOCK_CLOSED_PULLS: JSON.stringify(closedPulls), MOCK_COMPARISONS: JSON.stringify(comparisons), MOCK_DELETE_LOG: deleteLog
  }});
  const report = existsSync(jsonFile) ? JSON.parse(await readFile(jsonFile, 'utf8')) : null;
  const deleted = existsSync(deleteLog) ? (await readFile(deleteLog, 'utf8')).trim().split('\n').filter(Boolean) : [];
  await rm(directory, { recursive: true, force: true }); return { result, report, deleted };
}
test('el inventario contiene 21 registros fijados a SHA únicos', async () => {
  const source = (await readFile(script, 'utf8')).replace(/\r\n/g, '\n'); const start = source.indexOf('const reviewedObsoleteBranches = new Map([');
  const end = source.indexOf('\n]);\n\nif (!token)', start); assert.ok(start >= 0 && end > start);
  const shas = [...source.slice(start, end).matchAll(/sha: '([0-9a-f]{40})'/g)].map(m => m[1]); const counts = new Map();
  for (const sha of shas) counts.set(sha, (counts.get(sha) || 0) + 1); const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
  assert.equal(shas.length, 21); assert.equal(counts.size, 21); assert.deepEqual(duplicates, []);
});
test('audit clasifica sin borrar y conserva ramas sensibles', async () => {
  const { result, report, deleted } = await runCase({ mode: 'audit', ref: '343/merge' }); assert.equal(result.status, 0, result.stderr);
  assert.equal(report.summary.keep, 4); assert.equal(report.summary.safeDelete, 4); assert.equal(report.summary.review, 2); assert.deepEqual(deleted, []);
});
test('un PR fusionado hacia otra base no autoriza el borrado', async () => {
  const { result, report } = await runCase({ mode: 'audit', ref: '343/merge' }); assert.equal(result.status, 0, result.stderr);
  const record = report.records.find(item => item.branch === 'feature/merged-develop');
  assert.equal(record.classification, 'review'); assert.match(record.reason, /no presentes en main/);
});
test('una rama revisada que cambia vuelve a revisión manual', async () => {
  const branchSet = branches.map(item => item.name === 'temp/noop-test' ? branch(item.name, 'sha-nuevo-no-revisado') : item);
  const { result, report } = await runCase({ mode: 'audit', ref: '343/merge', branchSet }); assert.equal(result.status, 0, result.stderr);
  const changed = report.records.find(r => r.branch === 'temp/noop-test'); assert.equal(changed.classification, 'review'); assert.match(changed.reason, /cambió desde la revisión/);
});
test('delete se rechaza fuera de la rama principal', async () => {
  const { result, deleted } = await runCase({ mode: 'delete', ref: 'feature/open', confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /solo puede ejecutarse desde la rama principal main/); assert.deepEqual(deleted, []);
});
test('delete se bloquea por completo mientras exista una rama en revisión', async () => {
  const { result, report, deleted } = await runCase({ mode: 'delete', ref: 'main', confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS' });
  assert.notEqual(result.status, 0); assert.equal(report.summary.review, 2); assert.deepEqual(deleted, []);
});
test('audit puede exigir cero revisiones y conserva el informe al fallar', async () => {
  const { result, report, deleted } = await runCase({ mode: 'audit', ref: '343/merge', requireZeroReview: true });
  assert.notEqual(result.status, 0); assert.equal(report.summary.review, 2); assert.deepEqual(deleted, []);
});
test('delete elimina solo ramas verificadas y no toca ramas sensibles', async () => {
  const { result, report, deleted } = await runCase({ mode: 'delete', ref: 'main', confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS', branchSet: deletableBranches });
  assert.equal(result.status, 0, result.stderr); assert.equal(report.summary.deleted, 4); assert.equal(deleted.length, 4);
});
test('una carrera detectada en prevalidación bloquea todo el lote', async () => {
  const liveBranchSet = deletableBranches.map(item => item.name === 'temp/noop-test' ? branch(item.name, 'sha-que-aparecio-despues-del-informe') : item);
  const { result, report, deleted } = await runCase({ mode: 'delete', ref: 'main', confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS', branchSet: deletableBranches, liveBranchSet });
  assert.notEqual(result.status, 0); assert.equal(report.summary.deleted, 0); assert.equal(report.summary.deletePreflightBlocked, true); assert.deepEqual(deleted, []);
  const advanced = report.records.find(r => r.branch === 'temp/noop-test'); assert.equal(advanced.classification, 'review');
});
test('un PR abierto durante la prevalidación bloquea todo el lote', async () => {
  const { result, report, deleted } = await runCase({ mode: 'delete', ref: 'main', confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS', branchSet: deletableBranches, liveOpenPullBranches: ['feature/no-unique'] });
  assert.notEqual(result.status, 0); assert.equal(report.summary.deleted, 0); assert.equal(report.summary.deletePreflightBlocked, true); assert.deepEqual(deleted, []);
  const opened = report.records.find(r => r.branch === 'feature/no-unique'); assert.equal(opened.classification, 'keep');
});
