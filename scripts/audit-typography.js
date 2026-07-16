#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260716-product-page-1';
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.md', '.txt', '.json']);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules']);
const EXCLUDED_FILES = new Set([
  path.normalize('scripts/audit-typography.js'),
]);
const REQUIRED_FONT_FILES = [
  'montserrat-cyrillic-ext-wght-normal.woff2',
  'montserrat-cyrillic-wght-normal.woff2',
  'montserrat-vietnamese-wght-normal.woff2',
  'montserrat-latin-ext-wght-normal.woff2',
  'montserrat-latin-wght-normal.woff2',
  'montserrat-cyrillic-ext-wght-italic.woff2',
  'montserrat-cyrillic-wght-italic.woff2',
  'montserrat-vietnamese-wght-italic.woff2',
  'montserrat-latin-ext-wght-italic.woff2',
  'montserrat-latin-wght-italic.woff2',
];
const FORBIDDEN_FONT_TERMS = [
  'Poppins',
  'Playfair Display',
  'Roboto',
  'Open Sans',
  'Lato',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Segoe UI',
  'Verdana',
  'Tahoma',
  'DM Sans',
  'Cormorant Garamond',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'monospace',
  'Menlo',
  'Monaco',
  'Courier New',
  'Fira Code',
  'Source Code Pro',
];

const failures = [];
let checks = 0;

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  checks += 1;
  if (!condition) fail(message);
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    if (!EXCLUDED_FILES.has(path.normalize(path.relative(ROOT, absolute)))) files.push(absolute);
  }
  return files;
}

function countMatches(source, regex) {
  return (source.match(regex) || []).length;
}

function normalizeFontValue(value) {
  return String(value)
    .replace(/\s*!important\s*$/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const rootPages = fs.readdirSync(ROOT)
  .filter(name => name.toLowerCase().endsWith('.html'))
  .sort();

check(rootPages.length === 18, `Se esperaban 18 páginas HTML raíz y se encontraron ${rootPages.length}.`);

for (const page of rootPages) {
  const source = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const stylesheetCount = countMatches(
    source,
    new RegExp(`href=["']css/montserrat\\.css\\?v=${VERSION}["']`, 'gi')
  );
  const normalPreloadCount = countMatches(
    source,
    /rel=["']preload["'][^>]*href=["']assets-tintin\/fonts\/montserrat-latin-wght-normal\.woff2["']|href=["']assets-tintin\/fonts\/montserrat-latin-wght-normal\.woff2["'][^>]*rel=["']preload["']/gi
  );
  const italicPreloadCount = countMatches(
    source,
    /rel=["']preload["'][^>]*href=["']assets-tintin\/fonts\/montserrat-latin-wght-italic\.woff2["']|href=["']assets-tintin\/fonts\/montserrat-latin-wght-italic\.woff2["'][^>]*rel=["']preload["']/gi
  );
  check(stylesheetCount === 1, `${page}: debe cargar exactamente una vez css/montserrat.css con la versión ${VERSION}.`);
  check(normalPreloadCount === 1, `${page}: falta o está duplicado el preload de Montserrat normal.`);
  check(italicPreloadCount === 1, `${page}: falta o está duplicado el preload de Montserrat italic.`);
  check(!/fonts\.(?:googleapis|gstatic)\.com/i.test(source), `${page}: todavía carga una fuente externa de Google Fonts.`);

  for (const match of source.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)(?:\?v=([^"']+))?["'][^>]*>/gi)) {
    const href = match[1];
    const cacheVersion = match[2] || '';
    if (/^(?:https?:)?\/\//i.test(href)) continue;
    check(cacheVersion === VERSION, `${page}: ${href} conserva una versión de caché distinta de ${VERSION}.`);
  }
}

const fontDirectory = path.join(ROOT, 'assets-tintin', 'fonts');
check(fs.existsSync(fontDirectory), 'No existe assets-tintin/fonts.');
for (const fontFile of REQUIRED_FONT_FILES) {
  const absolute = path.join(fontDirectory, fontFile);
  check(fs.existsSync(absolute), `Falta el archivo ${relative(absolute)}.`);
  if (fs.existsSync(absolute)) check(fs.statSync(absolute).size > 1000, `${relative(absolute)} parece vacío o inválido.`);
}
check(fs.existsSync(path.join(fontDirectory, 'OFL-1.1.txt')), 'Falta la licencia OFL de Montserrat.');

const localFontFiles = fs.existsSync(fontDirectory)
  ? fs.readdirSync(fontDirectory).filter(name => /\.(?:woff2?|ttf|otf|eot)$/i.test(name))
  : [];
check(localFontFiles.length === REQUIRED_FONT_FILES.length, 'Hay archivos tipográficos locales no previstos o faltantes.');
for (const fontFile of localFontFiles) {
  check(/^montserrat-/i.test(fontFile), `Fuente local no permitida: assets-tintin/fonts/${fontFile}.`);
}

const globalCssPath = path.join(ROOT, 'css', 'montserrat.css');
check(fs.existsSync(globalCssPath), 'Falta css/montserrat.css.');
const globalCss = fs.existsSync(globalCssPath) ? fs.readFileSync(globalCssPath, 'utf8') : '';
check(countMatches(globalCss, /@font-face\s*\{/gi) === 10, 'css/montserrat.css debe declarar 10 bloques @font-face.');
check(countMatches(globalCss, /font-style:\s*normal\s*;/gi) === 5, 'Deben existir 5 subconjuntos normales de Montserrat.');
check(countMatches(globalCss, /font-style:\s*italic\s*;/gi) === 5, 'Deben existir 5 subconjuntos italic de Montserrat.');
check(countMatches(globalCss, /font-weight:\s*100 900\s*;/gi) === 10, 'Cada @font-face debe cubrir pesos reales 100–900.');
check(countMatches(globalCss, /font-display:\s*block\s*;/gi) === 10, 'Cada @font-face debe bloquear el fallback visible durante la carga.');
check(/body\s*\*/i.test(globalCss), 'La regla global debe cubrir contenido insertado dinámicamente.');
check(/\*::before[\s\S]*\*::after[\s\S]*\*::placeholder/i.test(globalCss), 'La regla global debe cubrir pseudoelementos y placeholders.');
check(/svg text[\s\S]*svg tspan/i.test(globalCss), 'La regla global debe cubrir texto SVG.');
check(/font-synthesis:\s*none/i.test(globalCss), 'Debe desactivarse la simulación de pesos y cursivas.');

const requiredTokens = [
  '--font-family-primary',
  '--font-family-secondary',
  '--font-family-heading',
  '--font-family-body',
  '--font-family-button',
  '--font-family-form',
  '--font-family-admin',
  '--font-heading',
  '--font-body',
  '--font-display',
  '--font',
  '--serif',
  '--adm-font',
];
for (const token of requiredTokens) {
  check(
    new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*["']Montserrat["']\\s*;`, 'i').test(globalCss),
    `El token ${token} no resuelve exclusivamente a Montserrat.`
  );
}

for (const file of walk(ROOT)) {
  const name = relative(file);
  const source = fs.readFileSync(file, 'utf8');

  for (const match of source.matchAll(/font-family\s*:\s*(?:(['"])([^'"]+)\1|([^;}\r\n>"']+))/gi)) {
    const rawValue = match[2] || match[3] || '';
    const value = normalizeFontValue(rawValue);
    check(value === 'Montserrat', `${name}: font-family no permitido: ${rawValue.trim()}`);
  }

  for (const match of source.matchAll(/(?:^|[;{])\s*font\s*:\s*([^;}\r\n}]+)/gim)) {
    const value = match[1].trim();
    const usesMontserrat = /\bMontserrat\b/i.test(value);
    const inheritsMontserrat = /^inherit$/i.test(value);
    const usesMontserratToken = /var\(--(?:font-heading|font-body|font-display|font|serif|adm-font)\)/i.test(value);
    check(
      usesMontserrat || inheritsMontserrat || usesMontserratToken,
      `${name}: shorthand font sin Montserrat: ${value}`
    );
  }

  for (const match of source.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
    const family = /font-family\s*:\s*([^;}\r\n]+)/i.exec(match[1]);
    check(Boolean(family), `${name}: @font-face sin font-family.`);
    if (family) check(normalizeFontValue(family[1]) === 'Montserrat', `${name}: @font-face pertenece a otra familia.`);
  }

  if (!name.endsWith('diagnostic-manifest.json')) {
    check(!/fonts\.(?:googleapis|gstatic)\.com/i.test(source), `${name}: contiene una importación remota de fuentes.`);
    check(!/@import\s+(?:url\()?[^;\r\n]*font/i.test(source), `${name}: contiene una importación tipográfica @import.`);
    check(!/\b(?:font-serif|font-sans|font-mono)\b/i.test(source), `${name}: conserva una clase utilitaria tipográfica.`);
    check(!/\btitle_font_family\b/i.test(source), `${name}: conserva un selector de familia tipográfica.`);

    for (const term of FORBIDDEN_FONT_TERMS) {
      const termPattern = new RegExp(`(^|[^a-z0-9_-])${escapeRegex(term)}([^a-z0-9_-]|$)`, 'i');
      check(!termPattern.test(source), `${name}: todavía menciona la fuente no permitida "${term}".`);
    }
  }
}

const adminSource = [
  fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'js', 'admin-app.js'), 'utf8')
].join('\n');
check(/function buildPreviewHtml_/.test(adminSource), 'No se encontró la vista previa de email del Super Admin.');
check(/fontBase = new URL\('assets-tintin\/fonts\/'/.test(adminSource), 'El iframe de vista previa no carga Montserrat local.');
check(/srcdoc = html/.test(adminSource), 'No se encontró la conexión de la vista previa srcdoc.');

const diagnosticSource = fs.readFileSync(path.join(ROOT, 'js', 'admin-site-diagnostics.js'), 'utf8');
check(/getComputedStyle\(element\)/.test(diagnosticSource), 'Diagnóstico no comprueba la familia calculada de los textos.');
check(/style\.fontFamily/.test(diagnosticSource), 'Diagnóstico no inspecciona fontFamily calculado.');
check(/getComputedStyle\(element,\s*['"]::placeholder['"]\)/.test(diagnosticSource), 'Diagnóstico no comprueba placeholders.');
check(/primaryFamily !== ['"]Montserrat['"]/.test(diagnosticSource), 'Diagnóstico no exige Montserrat como familia calculada.');

const iconFontTerms = /Font Awesome|Material Icons|IcoMoon|Glyphicons|fontawesome-webfont|material-icons/i;
for (const file of walk(ROOT)) {
  const name = relative(file);
  const source = fs.readFileSync(file, 'utf8');
  check(!iconFontTerms.test(source), `${name}: se detectó una posible fuente de iconos pendiente de migrar a SVG.`);
}

if (failures.length) {
  console.error(`\nAuditoría tipográfica fallida: ${failures.length} problema(s).\n`);
  failures.forEach((message, index) => console.error(`${index + 1}. ${message}`));
  process.exit(1);
}

console.log(`Auditoría tipográfica correcta: ${checks} comprobaciones, 18 páginas y 10 archivos WOFF2.`);
console.log('Montserrat es la única familia configurada en el código controlado por la plataforma.');
