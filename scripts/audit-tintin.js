#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'functions/node_modules']);
const VERSION = 'tintin-20260713-3';

const issues = [];

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (item.isDirectory()) {
      if (!IGNORED_DIRS.has(rel) && !IGNORED_DIRS.has(item.name)) out.push(...walk(full));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function addIssue(level, file, message) {
  issues.push({ level, file, message });
}

function assertFile(rel, message) {
  if (!fs.existsSync(path.join(ROOT, rel))) addIssue('CRITICAL', rel, message || 'Archivo requerido no existe');
}

function isAllowedLegacyLogoReference(file) {
  return [
    'js/page-audit-fix.js',
    'js/ui-quality.js',
    'js/page-loader.js',
    'scripts/audit-tintin.js',
    'scripts/fix-tintin-source.js'
  ].includes(file);
}

const files = walk(ROOT);
const htmlFiles = files.filter(f => f.endsWith('.html'));
const cssFiles = files.filter(f => f.endsWith('.css'));
const jsFiles = files.filter(f => f.endsWith('.js') && !f.startsWith('functions/'));

assertFile('assets-tintin/images/general/logo.png', 'Debe existir el logo real PNG usado por loader/header');
assertFile('css/tintin-unified-theme.css', 'Debe existir la fuente única de tokens Tintin');
assertFile('css/tintin-theme-cleanup.css', 'Debe existir la limpieza de colores hardcodeados');
assertFile('css/tintin-parity-safe.css', 'Debe existir la paridad responsive segura');
assertFile('js/ui-quality.js', 'Debe existir el runtime global de calidad');
assertFile('js/page-loader.js', 'Debe existir el loader global');
assertFile('js/header-account-mobile-fix.js', 'Debe existir el fix de account-dropdown/tabbar-avatar');
assertFile('js/page-audit-fix.js', 'Debe existir el fix de auditoría por página');
assertFile('js/theme-color-sanitizer.js', 'Debe existir el sanitizador de colores');
assertFile('scripts/fix-tintin-source.js', 'Debe existir el auto-fixer de fuente');
assertFile('firestore.rules', 'Debe existir el archivo de reglas Firestore');
assertFile('firebase.json', 'Debe existir firebase.json apuntando a firestore.rules');
assertFile('package.json', 'Debe existir package.json con scripts operativos');

for (const file of files.filter(f => /\.(html|css|js|md)$/.test(f))) {
  const content = read(file);
  if (/logo-splash|logo-tintin/i.test(content) && !isAllowedLegacyLogoReference(file)) {
    addIssue('WARN', file, 'Contiene referencia a logo viejo: logo-splash/logo-tintin');
  }
  if (/\.(html|css|js)$/.test(file) && /#[0-9a-fA-F]{3,8}/.test(content) && !['css/tintin-unified-theme.css','css/tintin-theme-cleanup.css','css/tintin-tokens.css','js/theme-color-sanitizer.js','js/page-audit-fix.js','js/page-loader.js'].includes(file)) {
    addIssue('INFO', file, 'Contiene colores hex directos; verificar que pasen por variables o sanitizador');
  }
}

// Antirregresión: el wordmark textual "TINTIN / ACCESORIOS & RELOJES" del
// footer (div.tt-logo-text / div.tt-logo-sub) quedaba fuera de flujo por un
// selector .tt-logo-link{position:absolute} demasiado genérico y terminaba
// flotando encima del Hero. Se eliminó del footer a favor del mismo logo en
// imagen que ya usan el resto de las páginas — estas clases quedaron
// completamente retiradas del sitio, no deben volver a aparecer en HTML
// productivo ni ser insertadas por JS (innerHTML, classList, etc).
{
  const selfFile = 'scripts/audit-tintin.js';
  for (const file of [...htmlFiles, ...jsFiles]) {
    if (file === selfFile) continue;
    const content = read(file);
    if (/\btt-logo-text\b/.test(content)) {
      addIssue('CRITICAL', file, 'Contiene tt-logo-text (wordmark textual del footer, eliminado) — no debe reaparecer');
    }
    if (/\btt-logo-sub\b/.test(content)) {
      addIssue('CRITICAL', file, 'Contiene tt-logo-sub (wordmark textual del footer, eliminado) — no debe reaparecer');
    }
  }
}

// Antirregresión: no debe existir ningún header superior de mobile. En
// <=768px la única navegación persistente es .tt-tabbar — ninguna página
// pública puede volver a contener id="tt-header-mobile", y ningún CSS/JS
// productivo puede forzar su visibilidad (display:block/flex; la única
// declaración permitida sobre este selector es display:none).
{
  const selfFile = 'scripts/audit-tintin.js';
  for (const file of htmlFiles) {
    const content = read(file);
    if (/id=["']tt-header-mobile["']/.test(content)) {
      addIssue('CRITICAL', file, 'Contiene id="tt-header-mobile" — el header superior de mobile fue eliminado, no debe reaparecer');
    }
  }
  const forceVisibleRe = /#tt-header-mobile[^{;]*\{[^}]*display\s*:\s*(block|flex|inline)/i;
  for (const file of [...cssFiles, ...jsFiles]) {
    if (file === selfFile) continue;
    const content = read(file);
    if (forceVisibleRe.test(content)) {
      addIssue('CRITICAL', file, 'Fuerza display:block/flex sobre #tt-header-mobile — no debe volver a mostrarse en ningún ancho');
    }
  }
}

// Antirregresión: topOnReload() (js/ui-quality.js) solamente puede reposicionar
// el scroll una vez, de forma síncrona, durante una recarga real — no debe
// reaparecer ningún setTimeout ni listener de 'load' que vuelva a forzar
// scrollTo() después de que el sitio ya sea interactivo, y el
// requestAnimationFrame final solamente puede restaurar scrollBehavior.
{
  const uiQuality = read('js/ui-quality.js');
  const fnMatch = uiQuality.match(/function topOnReload\(\)\{[\s\S]*?\n\}/);
  if (!fnMatch) {
    addIssue('CRITICAL', 'js/ui-quality.js', 'No se encontró topOnReload() — no se pudo verificar el antirregresión de scroll');
  } else {
    const fnBody = fnMatch[0];
    if (/setTimeout\(/.test(fnBody)) {
      addIssue('CRITICAL', 'js/ui-quality.js', 'topOnReload() contiene setTimeout() — puede reposicionar el scroll tarde, después de que el usuario ya empezó a scrollear');
    }
    if (/addEventListener\(\s*['"]load['"]/.test(fnBody)) {
      addIssue('CRITICAL', 'js/ui-quality.js', "topOnReload() contiene un listener de 'load' — no debe volver a reposicionar el scroll una vez que el sitio es interactivo");
    }
    const rafMatches = fnBody.match(/requestAnimationFrame\(/g) || [];
    if (rafMatches.length > 1) {
      addIssue('CRITICAL', 'js/ui-quality.js', 'topOnReload() contiene más de un requestAnimationFrame() — solamente puede haber uno, y solo para restaurar scrollBehavior');
    }
    const rafBodyMatch = fnBody.match(/requestAnimationFrame\(function\(\)\{([\s\S]*?)\}\)/);
    if (rafBodyMatch && /scrollTo/.test(rafBodyMatch[1])) {
      addIssue('CRITICAL', 'js/ui-quality.js', 'El requestAnimationFrame() final de topOnReload() vuelve a ejecutar scrollTo() — solamente puede restaurar scrollBehavior');
    }
  }
}

// Antirregresión: el eyebrow del Hero de home ("Bienvenidas a TINTIN") ya no
// incluye "· Paraguay" — no debe reaparecer ni en el HTML fuente ni como
// fallback hardcodeado en js/site-content.js.
{
  const oldEyebrowRe = /Bienvenidas a TINTIN\s*(&middot;|·)\s*Paraguay/;
  // admin.html conserva el string viejo únicamente como valor exacto de
  // comparación para la migración puntual en Firestore (contLoadPage) — no
  // se muestra ni se usa como fallback. audit-tintin.js lo referencia acá
  // mismo para poder detectarlo en el resto del sitio.
  const eyebrowRegressionExclusions = new Set(['admin.html', 'scripts/audit-tintin.js']);
  for (const file of [...htmlFiles, ...jsFiles]) {
    if (eyebrowRegressionExclusions.has(file)) continue;
    const content = read(file);
    if (oldEyebrowRe.test(content)) {
      addIssue('CRITICAL', file, 'Contiene el texto viejo del eyebrow "Bienvenidas a TINTIN · Paraguay" — debe ser "Bienvenidas a TINTIN"');
    }
  }
  const indexHtml = read('index.html');
  const eyebrowMatch = indexHtml.match(/class="tt-hero-eyebrow">([^<]*)</);
  if (!eyebrowMatch) {
    addIssue('CRITICAL', 'index.html', 'No se encontró .tt-hero-eyebrow');
  } else if (eyebrowMatch[1].trim() !== 'Bienvenidas a TINTIN') {
    addIssue('CRITICAL', 'index.html', `.tt-hero-eyebrow debe ser exactamente "Bienvenidas a TINTIN" (encontrado: "${eyebrowMatch[1].trim()}")`);
  }
}

// Antirregresión: waitReady() (js/welcome-tutorial-runtime.js) resuelve
// "finish()" sincrónicamente cuando el loader/splash ya tienen .tt-out en el
// momento en que se llama — eso ocurre ANTES de que "t" y "obs" reciban su
// setTimeout()/MutationObserver, así que cleanup() no puede referenciarlas
// como const sin pasar por una ReferenceError de temporal dead zone. Deben
// declararse con let (inicializadas antes del early-return) y el clearTimeout
// / obs.disconnect() deben quedar guardados con un chequeo de truthiness.
{
  const welcomeRuntime = read('js/welcome-tutorial-runtime.js');
  const fnMatch = welcomeRuntime.match(/function waitReady\(\)\{[\s\S]*?\n  \}/);
  if (!fnMatch) {
    addIssue('CRITICAL', 'js/welcome-tutorial-runtime.js', 'No se encontró waitReady() — no se pudo verificar el antirregresión de TDZ');
  } else {
    const fnBody = fnMatch[0];
    if (!/let\s+t\s*=\s*null/.test(fnBody) || !/let\s+obs\s*=\s*null/.test(fnBody)) {
      addIssue('CRITICAL', 'js/welcome-tutorial-runtime.js', "waitReady() debe declarar 't' y 'obs' con let=null antes del early-return de readyNow(), o vuelve el ReferenceError de TDZ en cleanup()");
    }
    if (/[^.]\bclearTimeout\(t\)/.test(fnBody) && !/if\s*\(\s*t\s*\)\s*clearTimeout\(t\)/.test(fnBody)) {
      addIssue('CRITICAL', 'js/welcome-tutorial-runtime.js', 'clearTimeout(t) en waitReady() no está protegido por if(t) — puede volver a lanzar ReferenceError si finish() corre antes de asignar t');
    }
  }
}

for (const file of htmlFiles) {
  const content = read(file);
  const isCheckout = file.toLowerCase().includes('checkout');
  const hasLoader = /js\/page-loader\.js/.test(content);
  if (!hasLoader && !isCheckout && file !== 'index.html') {
    addIssue('WARN', file, 'HTML sin page-loader.js; puede no recibir tema/header/fixes globales');
  }
  if (/js\/page-loader\.js["']/.test(content)) {
    addIssue('INFO', file, `page-loader.js está sin query ?v=${VERSION}; ejecutar npm run fix:tintin para versionarlo directo`);
  }
  if (/styles\.css["']/.test(content)) {
    addIssue('INFO', file, `styles.css está sin query ?v=${VERSION}; ejecutar npm run fix:tintin para versionarlo directo`);
  }
  if (isCheckout && /id=["']tt-header["']|class=["'][^"']*tt-header/.test(content)) {
    addIssue('WARN', file, 'Checkout contiene header en HTML; ejecutar npm run fix:tintin para quitarlo de fuente');
  }
}

const firebaseJson = fs.existsSync(path.join(ROOT, 'firebase.json')) ? read('firebase.json') : '';
if (!/"firestore"\s*:\s*\{[\s\S]*"rules"\s*:\s*"firestore\.rules"/.test(firebaseJson)) {
  addIssue('CRITICAL', 'firebase.json', 'No apunta claramente a firestore.rules');
}

const packageJson = fs.existsSync(path.join(ROOT, 'package.json')) ? read('package.json') : '';
['audit:tintin', 'fix:tintin', 'deploy:rules'].forEach(scriptName => {
  if (!packageJson.includes(`"${scriptName}"`)) addIssue('CRITICAL', 'package.json', `Falta script ${scriptName}`);
});

const ui = fs.existsSync(path.join(ROOT, 'js/ui-quality.js')) ? read('js/ui-quality.js') : '';
[
  'theme-color-sanitizer.js',
  'header-account-mobile-fix.js',
  'page-audit-fix.js',
  'tintin-unified-theme.css',
  'tintin-theme-cleanup.css',
  'tintin-parity-safe.css'
].forEach(token => {
  if (!ui.includes(token)) addIssue('CRITICAL', 'js/ui-quality.js', `No carga ${token}`);
});

const counts = issues.reduce((acc, issue) => {
  acc[issue.level] = (acc[issue.level] || 0) + 1;
  return acc;
}, {});

console.log('Tintin audit');
console.log('============');
console.log(`HTML: ${htmlFiles.length}`);
console.log(`CSS: ${cssFiles.length}`);
console.log(`JS: ${jsFiles.length}`);
console.log(`Issues: ${issues.length}`);
console.log(`CRITICAL: ${counts.CRITICAL || 0}`);
console.log(`WARN: ${counts.WARN || 0}`);
console.log(`INFO: ${counts.INFO || 0}`);
console.log('');

for (const issue of issues) {
  console.log(`[${issue.level}] ${issue.file} — ${issue.message}`);
}

if ((counts.CRITICAL || 0) > 0) process.exit(1);
