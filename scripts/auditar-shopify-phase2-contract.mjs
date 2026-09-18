import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const core = read('js/core/store/shopify-phase2-pipeline.mjs');
const media = read('functions/api/admin-import-media.js');
const job = read('functions/api/admin-import-job.js');
const audit = read('SHOPIFY_PHASE2_AUDIT_2026-09-18.md');
const checks = [
  ['pipeline es side-effect free', !/setDoc\(|addDoc\(|deleteDoc\(|fetch\(/.test(core)],
  ['staging no pisa active', /catalogState: 'STAGING'/.test(core)],
  ['activation exige staging listo', /READY_TO_ACTIVATE/.test(core)],
  ['rollback conserva catálogo anterior', /previousCatalogId/.test(core)],
  ['media exige Super Admin', /requireSuperAdmin\(request\)/.test(media)],
  ['media copy exige guard explícito', /SHOPIFY_PHASE2_MEDIA_WRITE/.test(media)],
  ['media no usa cliente', !/window\.|document\./.test(media)],
  ['job production sigue dry-run', /catalogMigration: 'not-executed'/.test(job) && /dryRun: true/.test(job)],
  ['documentación declara migración no ejecutada', /REAL COMMERCIAL MIGRATION.*NOT STARTED/s.test(audit)],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}`);
if (failed.length) process.exitCode = 1;
