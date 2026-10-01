import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../functions/api/admin-import-job.js', import.meta.url), 'utf8');
const importUiSource = fs.readFileSync(new URL('../../js/admin/importacion-admin.js', import.meta.url), 'utf8');

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

test('admin import job solo deja aplicar un CSV de Shopify sin errores y registra el resultado', () => {
  assert.match(source, /next === 'RUNNING' && \(job\.source !== 'shopify-csv' \|\| Number\(job\.errors \|\| 0\) !== 0\)/);
  assert.match(source, /RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed'/);
  assert.match(source, /next === 'COMPLETED' \? \{ created, skipped \}/);
  assert.match(source, /dryRun: next === 'RUNNING' \? false : job\.dryRun !== false/);
});

test('la restauración local queda visible aunque el preview esté vacío', () => {
  assert.match(importUiSource, /actions\.append\(clear, createJob, ready\)/);
  assert.match(importUiSource, /body\.append\(statusGrid, backupWrap, drop, summaryEl, phase2Meta, jobStatus, restoreActions, preview\)/);
  assert.match(importUiSource, /const restoreActions = node\('div', 'phase10-actions'\); restoreActions\.appendChild\(restore\)/);
});

