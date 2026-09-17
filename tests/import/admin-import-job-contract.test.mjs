import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../functions/api/admin-import-job.js', import.meta.url), 'utf8');

test('admin import job conserva estados, ownership y dry-run server-side', () => {
  for (const state of ['PREVIEW', 'READY', 'RUNNING', 'PAUSED', 'FAILED', 'COMPLETED', 'CANCELLED']) {
    assert.match(source, new RegExp(`['"]${state}['"]`));
  }
  assert.match(source, /requireSuperAdmin\(request\)/);
  assert.match(source, /createdByUid !== actor\.uid/);
  assert.match(source, /currentDocument: \{ exists: false \}/);
  assert.match(source, /dryRun: true/);
  assert.match(source, /catalogMigration: 'not-executed'/);
  assert.doesNotMatch(source, /products\/\$\{jobId\}/);
  assert.doesNotMatch(source, /collection\(db, ['"]products['"]\)/);
});

