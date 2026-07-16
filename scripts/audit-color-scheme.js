#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
let failures = 0;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function filesUnder(dir, extensions) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(rel, extensions));
    else if (extensions.has(path.extname(entry.name))) out.push(rel);
  }
  return out;
}

function arraySection(source, exportName) {
  const start = source.indexOf(`export const ${exportName} = [`);
  if (start < 0) return '';
  const end = source.indexOf('\n];', start);
  return end < 0 ? '' : source.slice(start, end + 3);
}

function parseTokens(section) {
  const tokens = [];
  const pattern = /\{\s*key:\s*'([^']+)',\s*cssVar:\s*'([^']+)',\s*label:\s*'([^']+)',\s*category:\s*'([^']+)',\s*default:\s*'([^']+)'\s*\}/g;
  let match;
  while ((match = pattern.exec(section))) {
    tokens.push({ key: match[1], cssVar: match[2], label: match[3], category: match[4], default: match[5] });
  }
  return tokens;
}

const catalogSource = read('js/color-scheme-catalog.js');
const globalTokens = parseTokens(arraySection(catalogSource, 'GLOBAL_TOKENS'));
const adminTokens = parseTokens(arraySection(catalogSource, 'ADMIN_TOKENS'));
const globalCss = read('css/color-tokens.css');
const adminCss = read('css/admin-color-tokens.css');
const adminHtml = read('admin.html');
const adminApp = read('js/admin-app.js');
const picker = read('js/color-picker-widget.js');
const globalRuntime = read('js/color-scheme.js');
const adminRuntime = read('js/admin-color-scheme.js');

check('El catálogo global contiene todos los tokens esperados', globalTokens.length >= 150, `${globalTokens.length} encontrados`);
check('El catálogo administrativo contiene todos los tokens esperados', adminTokens.length >= 36, `${adminTokens.length} encontrados`);
check('No hay claves globales duplicadas', new Set(globalTokens.map(token => token.key)).size === globalTokens.length);
check('No hay variables globales duplicadas', new Set(globalTokens.map(token => token.cssVar)).size === globalTokens.length);
check('No hay claves administrativas duplicadas', new Set(adminTokens.map(token => token.key)).size === adminTokens.length);
check('No hay variables administrativas duplicadas', new Set(adminTokens.map(token => token.cssVar)).size === adminTokens.length);

const missingGlobalDefaults = globalTokens.filter(token => !globalCss.includes(`${token.cssVar}: ${token.default}`));
const missingAdminDefaults = adminTokens.filter(token => !adminCss.includes(`${token.cssVar}: ${token.default}`));
check('Todos los tokens globales tienen respaldo CSS', missingGlobalDefaults.length === 0, missingGlobalDefaults.map(token => token.cssVar).join(', '));
check('Todos los tokens administrativos tienen respaldo CSS', missingAdminDefaults.length === 0, missingAdminDefaults.map(token => token.cssVar).join(', '));

const consumerFiles = [
  ...filesUnder('css', new Set(['.css'])),
  ...filesUnder('js', new Set(['.js'])),
].filter(rel => !['css/color-tokens.css', 'css/admin-color-tokens.css', 'js/color-scheme-catalog.js'].includes(rel.replace(/\\/g, '/')));
const consumers = consumerFiles.map(read).join('\n');
const missingGlobalConsumers = globalTokens.filter(token => !consumers.includes(`var(${token.cssVar}`));
const missingAdminConsumers = adminTokens.filter(token => !consumers.includes(`var(${token.cssVar}`));
check('Cada token global controla al menos un consumidor real', missingGlobalConsumers.length === 0, missingGlobalConsumers.map(token => token.cssVar).join(', '));
check('Cada token administrativo controla al menos un consumidor real', missingAdminConsumers.length === 0, missingAdminConsumers.map(token => token.cssVar).join(', '));

check('Apariencia conserva una sola sección integrada', (adminHtml.match(/id="section-apariencia"/g) || []).length === 1);
check('Cada fila expone nombre, variable, muestra, valor y reset', [
  'tok.label',
  'tok.cssVar',
  'data-tcp-swatch',
  'data-val-label',
  'data-reset',
].every(fragment => adminApp.includes(fragment)));
check('El valor textual abre el mismo selector', adminApp.includes("valLabel.addEventListener('click', () => picker.open())"));
check('El selector exige confirmar o cancelar', [
  'data-tcp="confirm"',
  'data-tcp="cancel"',
  'onConfirm',
  'onCancel',
].every(fragment => picker.includes(fragment)));
check('La vista previa es inmediata sin mutar el borrador', picker.includes('opts.onPreview') && adminApp.includes('aparTransientColor'));
check('El selector admite HEX, RGB y HSL con validación', picker.includes('HEX, RGB o HSL') && picker.includes('isValidColor'));
check('El selector permite tono, saturación y luminosidad', [
  'data-tcp="h-range"',
  'data-tcp="s-range"',
  'data-tcp="l-range"',
].every(fragment => picker.includes(fragment)));
check('El cuentagotas se habilita solo si el navegador lo soporta', picker.includes('window.EyeDropper'));
check('Existe comparación del color anterior y nuevo', picker.includes('Anterior') && picker.includes('Nuevo'));
check('Existen reset individual, por categoría y total', [
  'restablecer ${tok.label}',
  'restablecer la categoría',
  'restablecer todo el esquema',
].every(fragment => adminApp.includes(fragment)));
check('Existe deshacer el último cambio', adminApp.includes('function aparUndoLast()') && adminHtml.includes('id="apar-toolbar"'));
check('Existe aviso real de cambios sin guardar', adminApp.includes("window.AdminUnsaved.register('appearance-colors'") && adminApp.includes('CAMBIOS SIN GUARDAR'));
check('La publicación muestra impacto antes de guardar', adminApp.includes('function aparPublishImpactMessage') && adminApp.includes('Impacto compartido'));
check('El contraste se verifica antes de publicar, incluso por dispositivo', adminApp.includes('contrastContexts') && adminApp.includes('DEVICE_BREAKPOINTS.forEach'));
check('La vista previa usa sobrescrituras por dispositivo', adminApp.includes('function aparResolvePreview') && adminApp.includes('aparPreviewDevice'));
check('El runtime público escucha Firestore en tiempo real', globalRuntime.includes('onSnapshot') && globalRuntime.includes("doc(db, 'colorSchemes'"));
check('El runtime administrativo escucha Firestore en tiempo real', adminRuntime.includes('onSnapshot') && adminRuntime.includes("doc(db, 'colorSchemes'"));
check('Los cambios publicados se aplican como variables CSS reales', globalRuntime.includes('root.style.setProperty') && adminRuntime.includes('root.style.setProperty'));
check('El runtime conserva caché para evitar parpadeos', globalRuntime.includes('localStorage.setItem') && adminRuntime.includes('localStorage.setItem'));

const htmlFiles = fs.readdirSync(ROOT).filter(file => file.endsWith('.html'));
const publicPages = htmlFiles.filter(file => !['admin.html', 'admin-images.html', 'nosotros.html'].includes(file));
const missingPublicAssets = publicPages.filter(file => {
  const html = read(file);
  return !html.includes('css/color-tokens.css') ||
    !html.includes('css/tintin-unified-theme.css') ||
    !html.includes('js/color-scheme-instant.js') ||
    !html.includes('js/color-scheme.js');
});
check('Todas las páginas públicas cargan tokens, bindings y runtime', missingPublicAssets.length === 0, missingPublicAssets.join(', '));
check('Las páginas administrativas cargan su esquema independiente', ['admin.html', 'admin-images.html'].every(file => {
  const html = read(file);
  return html.includes('css/admin-color-tokens.css') && html.includes('js/admin-color-scheme.js');
}));

if (failures) {
  console.error(`\nAuditoría de esquema de colores: ${failures} fallo(s).`);
  process.exit(1);
}

console.log(`\nAuditoría de esquema de colores completada: ${globalTokens.length} tokens globales y ${adminTokens.length} administrativos verificados.`);
