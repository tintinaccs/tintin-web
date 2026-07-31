import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = fileURLToPath(import.meta.url);
const PHASE10_VERSION = 'tintin-20260731-phase10-a11y-1';

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: options.stdio || 'pipe' });
}

function stageText(stage, file) {
  return git(['show', `:${stage}:${file}`]);
}

function write(file, content) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content).replace(/\r\n?/g, '\n'), 'utf8');
}

function conflictFiles() {
  return git(['diff', '--name-only', '--diff-filter=U']).trim().split(/\r?\n/).filter(Boolean);
}

function mergePhase8Runtime() {
  const ours = stageText(2, 'js/phase8-ui-ux.js');
  let theirs = stageText(3, 'js/phase8-ui-ux.js');
  const marker = '// Fase 10 se monta sobre la instancia única y ya estabilizada de Fase 8.';
  if (!theirs.includes(marker)) {
    const block = ours.slice(ours.indexOf(marker));
    if (!block || block === ours) throw new Error('No se encontró el arranque de Fase 10 en nuestra versión de phase8-ui-ux.js.');
    theirs = `${theirs.trimEnd()}\n\n${block.trim()}\n`;
  }
  write('js/phase8-ui-ux.js', theirs);
}

function mergePhase8Audit() {
  let theirs = stageText(3, 'scripts/audit-phase8-ui-ux.js');
  theirs = theirs
    .replace("html.includes('js/page-loader.js?v=tintin-20260730-phase8-ui-1')", `html.includes('js/page-loader.js?v=${PHASE10_VERSION}')`)
    .replace(
      "packageJson.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux/phase8-ui-ux.spec.js --project=chromium'",
      "packageJson.scripts['test:phase8-ui'] === 'playwright test tests/ui-ux --project=chromium'"
    );
  write('scripts/audit-phase8-ui-ux.js', theirs);
}

function mergeAppCheckAudit() {
  let theirs = stageText(3, 'scripts/audit-app-check-bootstrap.js');
  theirs = theirs.replace(/page-loader\.js\?v=tintin-[^'"\\s)]+/g, `page-loader.js?v=${PHASE10_VERSION}`);
  write('scripts/audit-app-check-bootstrap.js', theirs);
}

function resolve(file) {
  if (file === 'js/phase8-ui-ux.js') return mergePhase8Runtime();
  if (file === 'scripts/audit-phase8-ui-ux.js') return mergePhase8Audit();
  if (file === 'scripts/audit-app-check-bootstrap.js') return mergeAppCheckAudit();
  if (file === 'diagnostic-manifest.json') {
    write(file, stageText(2, file));
    return;
  }
  throw new Error(`Conflicto no previsto al integrar main: ${file}`);
}

git(['config', 'user.name', 'github-actions[bot]']);
git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
git(['fetch', 'origin', 'main'], { stdio: 'inherit' });
let mergeFailed = false;
try {
  git(['merge', '--no-commit', '--no-ff', 'origin/main'], { stdio: 'inherit' });
} catch {
  mergeFailed = true;
}

const conflicts = conflictFiles();
conflicts.forEach(resolve);
if (conflicts.length) git(['add', '--', ...conflicts], { stdio: 'inherit' });

const unresolved = conflictFiles();
if (unresolved.length) throw new Error(`Quedaron conflictos sin resolver: ${unresolved.join(', ')}`);
if (mergeFailed && !fs.existsSync(path.join(ROOT, '.git', 'MERGE_HEAD'))) {
  throw new Error('La integración de main falló sin dejar un merge recuperable.');
}

fs.unlinkSync(SELF);
git(['add', '-A'], { stdio: 'inherit' });
console.log('main integrado en la rama de Fase 10; contratos compartidos reconciliados.');
