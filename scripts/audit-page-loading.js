'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

const expectedPages = [
  '404.html',
  'about.html',
  'admin-images.html',
  'admin.html',
  'cambios-devoluciones.html',
  'catalogo.html',
  'checkout.html',
  'collections.html',
  'contact.html',
  'envios.html',
  'index.html',
  'login.html',
  'nosotros.html',
  'perfil.html',
  'preguntas-frecuentes.html',
  'privacidad.html',
  'product.html',
  'terminos.html',
];

const exists = relative => fs.existsSync(path.join(root, relative));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function fail(page, message) {
  failures.push(`${page}: ${message}`);
}

function stripQueryAndHash(value) {
  return String(value || '').split('#')[0].split('?')[0].trim();
}

function isIgnoredReference(value) {
  const ref = String(value || '').trim();
  return !ref ||
    ref === '#' ||
    /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(ref) ||
    /\$\{|\{\{|<%/.test(ref);
}

function resolveLocalReference(ownerFile, rawReference) {
  const clean = stripQueryAndHash(rawReference);
  if (!clean) return null;
  if (clean.startsWith('/')) return clean.slice(1);
  return path.normalize(path.join(path.dirname(ownerFile), clean)).replace(/\\/g, '/');
}

function extractTagReferences(html) {
  const references = [];
  const tagPattern = /<(?:script|link|img|source|a)\b[^>]*>/gi;
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const attrPattern = /\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi;
    for (const attr of tag.matchAll(attrPattern)) references.push(attr[2]);
  }
  return references;
}

function meaningfulBodyLength(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#\d+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function auditHtmlPage(page) {
  if (!exists(page)) {
    fail(page, 'no existe.');
    return;
  }

  const html = read(page);
  if (!/^\s*<!doctype html>/i.test(html)) fail(page, 'falta <!DOCTYPE html>.');
  if (!/<html\b/i.test(html) || !/<\/html>/i.test(html)) fail(page, 'estructura <html> incompleta.');
  if (!/<head\b/i.test(html) || !/<\/head>/i.test(html)) fail(page, 'estructura <head> incompleta.');
  if (!/<body\b/i.test(html) || !/<\/body>/i.test(html)) fail(page, 'estructura <body> incompleta.');
  if (!/<meta\s+name=["']viewport["']/i.test(html)) fail(page, 'falta viewport responsive.');

  const isRedirect = /http-equiv=["']refresh["']/i.test(html) || /location\.(?:replace|href|assign)/.test(html);
  if (!isRedirect && meaningfulBodyLength(html) < 10) fail(page, 'el cuerpo queda prácticamente vacío sin ser una redirección.');

  const ids = [...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(match => match[2]).filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length) fail(page, `IDs duplicados: ${duplicateIds.join(', ')}.`);

  for (const rawReference of extractTagReferences(html)) {
    if (isIgnoredReference(rawReference)) continue;
    const local = resolveLocalReference(page, rawReference);
    if (!local) continue;
    if (!exists(local)) fail(page, `referencia local inexistente: ${rawReference} → ${local}.`);
  }

  if (/TT_PAGE_LOADER_WAIT\s*=\s*true/.test(html)) {
    if (!/js\/page-loader\.js/.test(html)) fail(page, 'activa TT_PAGE_LOADER_WAIT pero no carga page-loader.js.');
    if (!/js\/color-scheme-instant\.js/.test(html)) fail(page, 'activa TT_PAGE_LOADER_WAIT pero no carga color-scheme-instant.js.');
  }

  const localScripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)]
    .map(match => match[2])
    .filter(reference => !isIgnoredReference(reference));
  const duplicates = [...new Set(localScripts.filter((value, index) => localScripts.indexOf(value) !== index))];
  if (duplicates.length) fail(page, `scripts locales duplicados: ${duplicates.join(', ')}.`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'functions'].includes(entry.name)) return [];
      return walk(absolute);
    }
    return [absolute];
  });
}

function auditJavascriptReferences() {
  const jsFiles = walk(root).filter(file => file.endsWith('.js') || file.endsWith('.mjs'));
  const patterns = [
    /\bimport\s+(?:[^'"()]+?\s+from\s+)?(["'])(\.{1,2}\/[^"']+)\1/g,
    /\bimport\(\s*(["'])(\.{1,2}\/[^"']+)\1\s*\)/g,
    /\bnew\s+URL\(\s*(["'])(\.{1,2}\/[^"']+)\1\s*,\s*import\.meta\.url\s*\)/g,
    /\bversioned\(\s*(["'])(\.{1,2}\/[^"']+)\1\s*\)/g,
  ];

  for (const absolute of jsFiles) {
    const relative = path.relative(root, absolute).replace(/\\/g, '/');
    const source = fs.readFileSync(absolute, 'utf8');
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const reference = match[2];
        const target = resolveLocalReference(relative, reference);
        if (!target || exists(target)) continue;
        fail(relative, `import/recurso relativo inexistente: ${reference} → ${target}.`);
      }
    }
  }
}

const actualPages = fs.readdirSync(root)
  .filter(name => name.endsWith('.html'))
  .sort();

for (const expected of expectedPages) {
  if (!actualPages.includes(expected)) fail('inventario', `falta ${expected}.`);
}
for (const page of actualPages) auditHtmlPage(page);
auditJavascriptReferences();

const productHtml = exists('product.html') ? read('product.html') : '';
const productRuntime = exists('js/product-maintenance.js') ? read('js/product-maintenance.js') : '';
const publicShell = exists('js/public-shell.js') ? read('js/public-shell.js') : '';
const collectionsStore = exists('js/collections-store.js') ? read('js/collections-store.js') : '';

if (!/id=["']product-detail["']/.test(productHtml)) fail('product.html', 'falta la raíz #product-detail.');
if (!/id=["']product-loading["']/.test(productHtml)) fail('product.html', 'falta el estado #product-loading.');
if (!/id=["']product-grid["']/.test(productHtml)) fail('product.html', 'falta la ficha #product-grid.');
if (!/function isProductPage\(\)/.test(productRuntime)) fail('js/product-maintenance.js', 'falta reconocimiento robusto de Producto.');
if (!/TintinProductPageRecognized/.test(productRuntime)) fail('js/product-maintenance.js', 'falta marca de reconocimiento para el smoke test.');
if (!/import\(versioned\('\.\/products-store\.js'\)\)/.test(publicShell)) fail('js/public-shell.js', 'no carga products-store.js.');
if (!/import '\.\/product-maintenance\.js/.test(collectionsStore)) fail('js/collections-store.js', 'no carga product-maintenance.js.');

if (warnings.length) {
  console.warn('\nADVERTENCIAS DE CARGA');
  warnings.forEach((warning, index) => console.warn(`${index + 1}. ${warning}`));
}

if (failures.length) {
  console.error('\nAUDITORÍA DE CARGA DE PÁGINAS: FALLÓ');
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(`AUDITORÍA DE CARGA DE PÁGINAS: OK · ${actualPages.length} HTML · referencias locales · imports relativos · loaders · IDs · Producto reconocido.`);
