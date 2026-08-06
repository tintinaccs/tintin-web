import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(root, 'scripts', 'auditar-limpiar-ramas.mjs');

const branches = [
  { name: 'main', protected: true, commit: { sha: 'mainsha' } },
  { name: 'release/stable', protected: true, commit: { sha: 'relsha' } },
  { name: 'backup/weekly', protected: false, commit: { sha: 'backsha' } },
  { name: 'feature/open', protected: false, commit: { sha: 'opensha' } },
  { name: 'feature/no-unique', protected: false, commit: { sha: 'nusha' } },
  { name: 'feature/merged', protected: false, commit: { sha: 'mergedsha' } },
  { name: 'feature/unique', protected: false, commit: { sha: 'uniqsha' } }
];

const openPulls = [
  {
    head: {
      repo: { full_name: 'tintinaccs/tintin-web' },
      ref: 'feature/open',
      sha: 'opensha'
    }
  }
];

const closedPulls = [
  {
    merged_at: '2026-08-06T00:00:00Z',
    head: {
      repo: { full_name: 'tintinaccs/tintin-web' },
      ref: 'feature/merged',
      sha: 'mergedsha'
    }
  }
];

const comparisons = {
  'main...feature/no-unique': { ahead_by: 0, behind_by: 2 },
  'main...feature/merged': { ahead_by: 1, behind_by: 0 },
  'main...feature/unique': { ahead_by: 3, behind_by: 0 }
};

const mockFetchSource = `
import { appendFileSync } from 'node:fs';

const branches = JSON.parse(process.env.MOCK_BRANCHES);
const openPulls = JSON.parse(process.env.MOCK_OPEN_PULLS);
const closedPulls = JSON.parse(process.env.MOCK_CLOSED_PULLS);
const comparisons = JSON.parse(process.env.MOCK_COMPARISONS);

function json(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  const method = options.method || 'GET';

  if (method === 'DELETE') {
    appendFileSync(process.env.MOCK_DELETE_LOG, value + '\\n');
    return json(null, 204);
  }
  if (value.endsWith('/repos/tintinaccs/tintin-web')) {
    return json({ default_branch: 'main' });
  }
  if (value.includes('/branches?')) return json(branches);
  if (value.includes('/pulls?state=open')) return json(openPulls);
  if (value.includes('/pulls?state=closed')) return json(closedPulls);

  for (const [key, result] of Object.entries(comparisons)) {
    if (value.includes('/compare/' + key)) return json(result);
  }

  throw new Error('URL no simulada: ' + value);
};
`;

async function runCase({ mode, ref, confirmation = '' }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tintin-branch-audit-'));
  const mockFile = path.join(directory, 'mock-fetch.mjs');
  const jsonFile = path.join(directory, 'branch-audit.json');
  const markdownFile = path.join(directory, 'branch-audit.md');
  const deleteLog = path.join(directory, 'deleted.log');
  await writeFile(mockFile, mockFetchSource);

  const result = spawnSync(process.execPath, ['--import', mockFile, script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPOSITORY: 'tintinaccs/tintin-web',
      GITHUB_REF_NAME: ref,
      BRANCH_CLEANUP_MODE: mode,
      BRANCH_CLEANUP_CONFIRMATION: confirmation,
      BRANCH_AUDIT_JSON: jsonFile,
      BRANCH_AUDIT_MARKDOWN: markdownFile,
      MOCK_BRANCHES: JSON.stringify(branches),
      MOCK_OPEN_PULLS: JSON.stringify(openPulls),
      MOCK_CLOSED_PULLS: JSON.stringify(closedPulls),
      MOCK_COMPARISONS: JSON.stringify(comparisons),
      MOCK_DELETE_LOG: deleteLog
    }
  });

  let report = null;
  if (existsSync(jsonFile)) report = JSON.parse(await readFile(jsonFile, 'utf8'));
  const deleted = existsSync(deleteLog)
    ? (await readFile(deleteLog, 'utf8')).trim().split('\n').filter(Boolean)
    : [];

  await rm(directory, { recursive: true, force: true });
  return { result, report, deleted };
}

test('audit clasifica sin borrar y conserva ramas sensibles', async () => {
  const { result, report, deleted } = await runCase({ mode: 'audit', ref: '343/merge' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.summary.defaultBranch, 'main');
  assert.equal(report.summary.keep, 4);
  assert.equal(report.summary.safeDelete, 2);
  assert.equal(report.summary.review, 1);
  assert.deepEqual(deleted, []);

  const kept = new Map(
    report.records
      .filter(record => record.classification === 'keep')
      .map(record => [record.branch, record.reason])
  );
  assert.match(kept.get('main'), /principal/);
  assert.match(kept.get('release/stable'), /protegida/);
  assert.match(kept.get('backup/weekly'), /respaldo/);
  assert.match(kept.get('feature/open'), /Pull Request abierto/);
});

test('delete se rechaza fuera de la rama principal', async () => {
  const { result, deleted } = await runCase({
    mode: 'delete',
    ref: 'feature/open',
    confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS'
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /solo puede ejecutarse desde la rama principal main/);
  assert.deepEqual(deleted, []);
});

test('delete elimina solo ramas verificadas y no toca protegidas, respaldos ni PR abiertos', async () => {
  const { result, report, deleted } = await runCase({
    mode: 'delete',
    ref: 'main',
    confirmation: 'ELIMINAR_SOLO_RAMAS_SEGURAS'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(report.summary.deleted, 2);
  assert.equal(deleted.length, 2);
  assert.ok(deleted.some(url => url.endsWith('/heads/feature/no-unique')));
  assert.ok(deleted.some(url => url.endsWith('/heads/feature/merged')));
  assert.ok(deleted.every(url => !url.includes('release/stable')));
  assert.ok(deleted.every(url => !url.includes('backup/weekly')));
  assert.ok(deleted.every(url => !url.includes('feature/open')));
});
