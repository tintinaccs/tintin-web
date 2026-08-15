'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const checkMode = process.argv.includes('--check');

execFileSync(process.execPath, [
  path.join(root, 'scripts/sincronizar-origen-publico.js'),
  ...(checkMode ? ['--check'] : [])
], { stdio: 'inherit' });
execFileSync(process.execPath, [
  path.join(root, 'scripts/normalizar-rutas-publicas.js'),
  ...(checkMode ? ['--check'] : [])
], { stdio: 'inherit' });
execFileSync(process.execPath, [
  path.join(root, 'scripts/endurecer-dependencias-terceros.js'),
  ...(checkMode ? ['--check'] : [])
], { stdio: 'inherit' });

const publicSite = JSON.parse(fs.readFileSync(path.join(root, 'config/public-site.json'), 'utf8'));
const publicOrigin = String(process.env.TINTIN_PUBLIC_ORIGIN || publicSite.origin || '').replace(/\/$/, '');
const headersPath = path.join(root, '_headers');
const runtimePoliciesPath = path.join(root, 'config/csp-runtime.json');
const startMarker = '# CSP_ROUTE_POLICIES_START';
const endMarker = '# CSP_ROUTE_POLICIES_END';
const baseScriptOrigins = ['https://*.gstatic.com', 'https://*.google.com', 'https://www.googletagmanager.com'];
const baseConnectOrigins = [
  'https://*.googleapis.com',
  'https://*.google.com',
  'https://*.gstatic.com',
  'https://*.googleusercontent.com',
  'https://*.google-analytics.com',
  'https://*.analytics.google.com'
];
const globalScriptOrigins = [...baseScriptOrigins, 'https://unpkg.com'];
const globalConnectOrigins = [...baseConnectOrigins];
const frameOrigins = [
  publicOrigin,
  'https://*.google.com',
  'https://*.gstatic.com',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com'
];
const CLOUDINARY_UPLOAD_PAGES = new Set(['admin.html', 'admin-images.html']);

const VISUAL_BUILDER_PREVIEWABLE_PAGES = new Set([
  'index.html', 'about.html', 'catalogo.html', 'collections.html',
  'contact.html', 'envios.html', 'preguntas-frecuentes.html', 'cambios-devoluciones.html',
  'product.html', 'terminos.html', 'privacidad.html', '404.html',
]);

function sha256Source(value) {
  return `'sha256-${crypto.createHash('sha256').update(value, 'utf8').digest('base64')}'`;
}

function inlineHashes(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    hashes.add(sha256Source(match[2]));
  }
  return [...hashes].sort();
}

function walkRuntimeFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || ['node_modules', 'artifacts', 'maintenance', 'tests'].includes(entry.name)) return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkRuntimeFiles(absolute);
    return /\.(?:html|js)$/i.test(entry.name) ? [absolute] : [];
  });
}

function eventHandlerHashes() {
  const files = [
    ...fs.readdirSync(root).filter(name => /\.(?:html|js)$/i.test(name)).map(name => path.join(root, name)),
    ...walkRuntimeFiles(path.join(root, 'js'))
  ];
  const values = new Set();
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
    const source = raw.replace(/\\"/g, '"').replace(/\\'/g, "'");
    for (const match of source.matchAll(/\bon[a-z]+\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      const value = String(match[2] || '').trim();
      if (value) values.add(value);
    }
  }
  return [...values].map(sha256Source).sort();
}

function allInlineScriptHashes() {
  const hashes = new Set();
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html')).sort()) {
    for (const hash of inlineHashes(file)) hashes.add(hash);
  }
  return [...hashes].sort();
}

const handlerHashes = eventHandlerHashes();
const globalInlineHashes = allInlineScriptHashes();

function scriptAttrDirective() {
  return handlerHashes.length
    ? `script-src-attr 'unsafe-hashes' ${handlerHashes.join(' ')}`
    : "script-src-attr 'none'";
}

// Cloudflare Pages puede resolver una URL limpia hacia su asset .html y
// terminar aplicando únicamente el bloque wildcard de _headers. El wildcard
// debe ser funcional por sí mismo, pero no por eso puede abrir unsafe-inline
// ni Cloudinary upload a toda la tienda. Para compatibilidad incluye la unión
// exacta de hashes de scripts/handlers realmente publicados; Admin recibe su
// excepción de upload en la política por página y en su Pages Function.
function globalPolicy() {
  return [
    "default-src 'self'",
    `script-src 'self'${globalInlineHashes.length ? ` ${globalInlineHashes.join(' ')}` : ''} ${globalScriptOrigins.join(' ')}`,
    scriptAttrDirective(),
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${globalConnectOrigins.join(' ')}`,
    `frame-src 'self' ${frameOrigins.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join('; ') + ';';
}

function pageUsesUnpkg(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').includes('https://unpkg.com/');
}

function pagePolicy(file) {
  const hashes = inlineHashes(file);
  const scripts = [...baseScriptOrigins];
  const styles = [];
  const connects = [...baseConnectOrigins];
  if (pageUsesUnpkg(file)) {
    scripts.push('https://unpkg.com');
    styles.push('https://unpkg.com');
  }
  if (CLOUDINARY_UPLOAD_PAGES.has(file)) connects.push('https://api.cloudinary.com');
  const styleSrc = `style-src 'self' 'unsafe-inline'${styles.length ? ` ${styles.join(' ')}` : ''}`;

  return [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''} ${scripts.join(' ')}`,
    scriptAttrDirective(),
    styleSrc,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${connects.join(' ')}`,
    `frame-src 'self' ${frameOrigins.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${VISUAL_BUILDER_PREVIEWABLE_PAGES.has(file) ? "'self'" : "'none'"}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join('; ') + ';';
}

function routesForFile(file) {
  if (file !== 'index.html') return [`/${path.basename(file, '.html')}`];
  return ['/', '/index.html'];
}

function generateRouteBlock() {
  const files = fs.readdirSync(root).filter(name => name.endsWith('.html')).sort();
  const blocks = files.flatMap(file => {
    const policy = pagePolicy(file);
    return routesForFile(file).map(route => `${route}\n  Content-Security-Policy: ${policy}`);
  });
  return `${startMarker}\n# Generado por scripts/generar-csp-cloudflare.js; no editar a mano.\n${blocks.join('\n\n')}\n${endMarker}`;
}

function runtimePolicies() {
  return {
    generatedBy: 'scripts/generar-csp-cloudflare.js',
    admin: pagePolicy('admin.html'),
    adminImages: pagePolicy('admin-images.html')
  };
}

function expectedHeaders() {
  let headers = fs.readFileSync(headersPath, 'utf8').replace(/\r\n?/g, '\n');
  headers = headers.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n*`, 'g'), '');
  headers = headers.replace(/^  Content-Security-Policy:.*$/m, `  Content-Security-Policy: ${globalPolicy()}`);
  const cacheRoot = '\n/\n  Cache-Control: no-cache, no-store, must-revalidate';
  if (!headers.includes(cacheRoot)) throw new Error('No se encontró el bloque de caché raíz en _headers.');
  return headers.replace(cacheRoot, `\n${generateRouteBlock()}\n${cacheRoot}`).replace(/\n{3,}/g, '\n\n');
}

const current = fs.readFileSync(headersPath, 'utf8').replace(/\r\n?/g, '\n');
const expected = expectedHeaders();
const runtimeExpected = JSON.stringify(runtimePolicies(), null, 2) + '\n';
const runtimeCurrent = fs.existsSync(runtimePoliciesPath) ? fs.readFileSync(runtimePoliciesPath, 'utf8') : '';

if (checkMode) {
  let failed = false;
  if (current !== expected) {
    console.error('ERROR — _headers no coincide con las CSP por ruta generadas. Ejecutá npm run build:csp.');
    failed = true;
  }
  if (runtimeCurrent !== runtimeExpected) {
    console.error('ERROR — config/csp-runtime.json no coincide con las políticas Admin generadas. Ejecutá npm run build:csp.');
    failed = true;
  }
  if (failed) process.exit(1);
  console.log(`OK — CSP reproducible; fallback global por hashes + ${handlerHashes.length} handler(s) inline restringidos por hash.`);
} else {
  fs.writeFileSync(headersPath, expected, 'utf8');
  fs.writeFileSync(runtimePoliciesPath, runtimeExpected, 'utf8');
  console.log(`CSP generada: fallback global por hashes; Admin conserva upload Cloudinary solo en sus rutas.`);
}
