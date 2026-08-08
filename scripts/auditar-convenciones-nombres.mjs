import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const failures = [];
const ignoredReferenceFiles = new Set([
  'scripts/auditar-convenciones-nombres.mjs',
  'scripts/cerrar-organizacion-nombres.mjs',
  'scripts/completar-cierre-nombres.mjs',
]);
const contractualDocumentNames = new Set(['AGENTS.md']);

function repositoryFiles() {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, encoding: 'utf8' }
  ).split('\0').filter(Boolean);
}

function fail(message) {
  failures.push(message);
}

const files = repositoryFiles();
const fileSet = new Set(files);

if (!fileSet.has('tienda.js')) fail('Falta la entrada principal tienda.js.');
if (fileSet.has('script.js')) fail('La entrada antigua script.js todavía existe.');
if (!fileSet.has('docs/excepciones-contractuales-nombres.md')) {
  fail('Falta la documentación de excepciones contractuales.');
}

const forbiddenAutomationTokens = new Set([
  'audit', 'apply', 'build', 'deploy', 'enforce', 'fix', 'level', 'part',
  'phase', 'prepare', 'release', 'run', 'test', 'validate', 'verify',
]);
const forbiddenResidualTokens = new Set([
  'about', 'account', 'compact', 'contact', 'content', 'email', 'fixes',
  'flow', 'help', 'home', 'images', 'interaction', 'latency', 'loading',
  'login', 'methods', 'metrics', 'mirror', 'navigation', 'orders', 'page',
  'payment', 'perf', 'product', 'products', 'production', 'profile', 'public',
  'reliability', 'scheme', 'security', 'site', 'source', 'special', 'store',
  'system', 'unified',
]);
const forbiddenCssTokens = new Set([
  'accessibility', 'background', 'brand', 'cleanup', 'fit', 'home', 'loader',
  'motion', 'parity', 'phase', 'picker', 'polish', 'quality', 'safe', 'safety',
  'special', 'states', 'surfaces', 'theme', 'unified',
]);
const forbiddenDocTokens = new Set([
  'audit', 'auth', 'cart', 'content', 'contract', 'contracts', 'deploy',
  'emails', 'order', 'phase', 'quality', 'secure', 'setup', 'store', 'sync',
  'users', 'validation',
]);

for (const file of files) {
  const base = path.basename(file);
  const stem = base.replace(/\.[^.]+$/, '');
  const tokens = stem.toLowerCase().split(/[-_.]+/).filter(Boolean);

  if (file.startsWith('.github/workflows/')) {
    for (const token of tokens) {
      if (forbiddenAutomationTokens.has(token)) {
        fail(`Workflow con token antiguo "${token}": ${file}`);
      }
    }
  }

  if (/^scripts\/[^/]+\.(?:js|mjs|cjs|sh)$/.test(file)) {
    for (const token of tokens) {
      if (forbiddenAutomationTokens.has(token) || forbiddenResidualTokens.has(token)) {
        fail(`Script con token pendiente "${token}": ${file}`);
      }
    }
  }

  if (file.startsWith('css/') && file.endsWith('.css')) {
    for (const token of tokens) {
      if (forbiddenCssTokens.has(token)) {
        fail(`CSS con token pendiente "${token}": ${file}`);
      }
    }
  }

  const isEligibleDoc = (
    (/^docs\/[^/]+\.md$/i.test(file)
      || /^[^/]+\.md$/i.test(file)
      || /^functions\/[^/]+\.md$/i.test(file))
    && base.toLowerCase() !== 'readme.md'
    && !contractualDocumentNames.has(base)
  );
  if (isEligibleDoc) {
    if (base !== base.toLowerCase()) fail(`Documento sin minúsculas: ${file}`);
    if (base.includes('_')) fail(`Documento con guion bajo: ${file}`);
    for (const token of tokens) {
      if (forbiddenDocTokens.has(token)) {
        fail(`Documento con token pendiente "${token}": ${file}`);
      }
    }
  }
}

const textExtensions = new Set([
  '.cjs', '.css', '.csv', '.gs', '.html', '.js', '.json', '.md', '.mjs',
  '.ps1', '.scss', '.sh', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml',
  '.yaml', '.yml',
]);
const textFilenames = new Set([
  '.env.example', '.firebaserc', '.gitignore', '_headers', '_redirects',
  'LICENSE', 'Makefile', 'Procfile', 'robots.txt', 'sitemap.xml',
]);

for (const file of files) {
  if (ignoredReferenceFiles.has(file)) continue;
  const absolute = path.join(ROOT, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const base = path.basename(file);
  if (!textFilenames.has(base) && !textExtensions.has(path.extname(base).toLowerCase())) continue;
  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  if (content.includes('script.js')) fail(`Referencia antigua a script.js en ${file}`);
}

if (failures.length) {
  console.error('Auditoría de convenciones de nombres: FALLÓ');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Auditoría de convenciones de nombres: OK (${files.length} archivos revisados).`);
