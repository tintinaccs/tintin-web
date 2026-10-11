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
  assert.match(importUiSource, /actions\.append\(toggleAll, clear\)/);
  assert.match(importUiSource, /body\.append\(statusGrid, backupWrap, drop, summaryEl, phase2Meta, jobStatus, restoreActions, preview\)/);
  assert.match(importUiSource, /const restoreActions = node\('div', 'phase10-actions'\); restoreActions\.appendChild\(restore\)/);
});


import vm from 'node:vm';
import * as core from '../../js/core/store/shopify-import-core.mjs';
import { reconcileShopifyImportIdentities } from '../../js/core/store/shopify-import-identity.mjs';

const resumeSource = fs.readFileSync(new URL('../../js/admin/aplicar-importacion-admin.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replace('export function createCatalogApply', 'function createCatalogApply');

function fixture({ existing = [], failSecondBatch = false, sheetsResult = true, throwSheets = false, missingSheets = false, refreshIdentity = false } = {}) {
  const records = Array.from({ length: failSecondBatch ? 51 : 2 }, (_, i) => ({ product: {
    name: `PRUEBA ${i}`, importFingerprint: `shopify:qa-${i}`, category: 'prueba', price: 1000, stock: 0, active: false,
  } }));
  const ids = records.map(record => core.stableProductDocumentId(record.product.importFingerprint));
  const documents = new Map(existing.map(([index, importJobId]) => [ids[index], { importJobId }]));
  const pushes = [], transitions = [], writes = [];
  let transactions = 0;
  const state = { source: 'shopify-csv', busy: false, backupAt: 'backup-fixture', jobId: 'imp_resume_fixture', job: { status: 'RUNNING' }, records, collections: [] };
  const context = vm.createContext({
    ...core, db: {}, console: { error() {} },
    window: { confirm: () => true, tintinPushProductsToSheets: async values => { pushes.push([...values]); if (throwSheets) throw new Error("Sheets unavailable"); return sheetsResult; } },
    doc: (_db, _collection, id) => id, serverTimestamp: () => 'fixture-time',
    runTransaction: async (_db, handler) => {
      transactions++;
      if (failSecondBatch && transactions === 2) throw new Error('Interrupted after first committed batch');
      return handler({ get: async id => ({ exists: () => documents.has(id), data: () => documents.get(id) }),
        set: (id, data) => { documents.set(id, data); writes.push(id); } });
    },
  });
  if (missingSheets) delete context.window.tintinPushProductsToSheets;
  vm.runInContext(resumeSource + '\nthis.factory = createCatalogApply;', context);
  const node = (_tag, _className, text = '') => ({ textContent: text, hidden: false, dataset: {}, children: [],
    append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); },
    setAttribute() {}, addEventListener(_event, handler) { this.handler = handler; } });
  const apply = context.factory({ state, isSuperAdmin: () => true,
    apiJob: async body => { transitions.push(body); return { ...state.job, status: body.status }; },
    authenticatedFetch: () => { assert.fail('No Shopify images in this fixture'); }, saveLocalJob: async () => {},
    renderPreview: () => {}, refreshCatalogIdentitySnapshot: refreshIdentity ? async () => {
      state.existingProducts = [...documents].map(([id, product]) => ({ id, ...product }));
      state.records = reconcileShopifyImportIdentities(state.records, state.existingProducts);
      return { invalid: state.records.filter(record => record.errors?.length).length };
    } : undefined, ensureReadyJob: async () => {}, takeBackup: async () => {}, toast: () => {}, node });
  const preview = node(); preview.insertBefore = child => preview.children.push(child);
  apply.mount(preview);
  const box = preview.children.at(-1), row = box.children.at(-1), button = row.children.at(-1);
  return { run: button.handler, ids, pushes, transitions, writes, state, reason: row.children[0] };
}

test('Resume after Firestore commit before Sheets push syncs same-job products without overwriting unrelated existing products', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture'], [1, 'another-import']] });
  await f.run();
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.pushes, [[f.ids[0]]]);
  assert.equal(f.transitions.at(-1).status, 'COMPLETED');
  assert.equal(f.transitions.at(-1).created, 1);
  assert.equal(f.transitions.at(-1).skipped, 1);
  assert.equal(f.state.busy, false);
});

test('Partial retry syncs both resumed and newly committed IDs when a later batch fails', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture']], failSecondBatch: true });
  await f.run();
  assert.equal(f.writes.length, 49);
  assert.deepEqual(f.pushes, [f.ids.slice(0, 50)]);
  assert.equal(f.transitions.at(-1).status, 'FAILED');
  assert.equal(f.state.busy, false);
});


test('Sheets rejection preserves a retryable job and releases busy even when the recovery push also rejects', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture']], throwSheets: true });
  await f.run();
  assert.equal(f.transitions.at(-1).status, 'FAILED');
  assert.equal(f.state.busy, false);
  assert.equal(f.writes.length, 1);
  assert.equal(f.pushes.length, 2);
  assert.deepEqual(f.pushes[0], f.ids);
  assert.deepEqual(f.pushes[1], f.ids);
});

test('Missing Sheets coordinator cannot mark the import COMPLETED with a false promise of automatic sync', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture']], missingSheets: true });
  await f.run();
  assert.equal(f.transitions.at(-1).status, 'FAILED');
  assert.equal(f.transitions.some(item => item.status === 'COMPLETED'), false);
  assert.equal(f.state.busy, false);
});


test('Real refresh/reconcile path still pushes recovered same-job IDs omitted from create-only batches', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture'], [1, 'another-import']], refreshIdentity: true });
  await f.run();
  assert.equal(f.state.records.every(record => record.duplicate && record.identityStatus === 'MATCHED_EXISTING'), true);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.pushes, [[f.ids[0]]]);
  assert.equal(f.transitions.at(-1).processed, 2);
  assert.equal(f.transitions.at(-1).created, 1);
  assert.equal(f.transitions.at(-1).skipped, 1);
});


test('Unconfirmed Sheets sync leaves FAILED/retryable instead of claiming the entire import completed', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture']], refreshIdentity: true, sheetsResult: false });
  await f.run();
  assert.equal(f.transitions.at(-1).status, 'FAILED');
  assert.equal(f.transitions.some(item => item.status === 'COMPLETED'), false);
  assert.equal(f.writes.length, 1);
  assert.match(f.reason.textContent, /2\/2/);
  assert.deepEqual(f.pushes[0], f.ids);
  assert.equal(f.state.busy, false);
});

test('Reconciled retry syncs recovered and newly created products and reports full progress', async () => {
  const f = fixture({ existing: [[0, 'imp_resume_fixture']], refreshIdentity: true });
  await f.run();
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.pushes, [f.ids]);
  assert.equal(f.transitions.at(-1).status, 'COMPLETED');
  assert.equal(f.transitions.at(-1).processed, 2);
  assert.equal(f.transitions.at(-1).created, 2);
  assert.equal(f.transitions.at(-1).skipped, 0);
});
