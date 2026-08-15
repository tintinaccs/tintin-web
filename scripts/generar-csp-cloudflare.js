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
const globalConnectOrigins = [...baseConnectOrigins, 'https://api.cloudinary.com'];
const frameOrigins = [
  publicOrigin,
  'https://*.google.com',
  'https://*.gstatic.com',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com'
];
const CLOUDINARY_UPLOAD_PAGES = new Set(['admin.html', 'admin-images.html']);

// Cloudflare Pages puede resolver una URL limpia hacia su asset .html y
// terminar aplicando únicamente el bloque wildcard de _headers. Por eso el
// wildcard DEBE ser funcional por sí solo. Conserva unsafe-inline solo como
// fallback de compatibilidad; las políticas específicas de cada página que
// aparecen debajo vuelven a restringir scripts/handlers mediante hashes.
const globalPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${globalScriptOrigins.join(' ')}`,
  "script-src-attr 'unsafe-inline'",
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

const handlerHashes = eventHandlerHashes();

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
  if (CLOUDINARY_UPLOAD_PAGES.has(file)) {
    connects.push('https://api.cloudinary.com');
  }
  const scriptAttr = handlerHashes.length
    ? `script-src-attr 'unsafe-hashes' ${handlerHashes.join(' ')}`
    : "script-src-attr 'none'";
  const styleSrc = `style-src 'self' 'unsafe-inline'${styles.length ? ` ${styles.join(' ')}` : ''}`;

  return [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''} ${scripts.join(' ')}`,
    scriptAttr,
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

function expectedHeaders() {
  let headers = fs.readFileSync(headersPath, 'utf8').replace(/\r\n?/g, '\n');
  headers = headers.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n*`, 'g'), '');
  headers = headers.replace(/^  Content-Security-Policy:.*$/m, `  Content-Security-Policy: ${globalPolicy}`);
  const cacheRoot = '\n/\n  Cache-Control: no-cache, no-store, must-revalidate';
  if (!headers.includes(cacheRoot)) throw new Error('No se encontró el bloque de caché raíz en _headers.');
  return headers.replace(cacheRoot, `\n${generateRouteBlock()}\n${cacheRoot}`).replace(/\n{3,}/g, '\n\n');
}

const current = fs.readFileSync(headersPath, 'utf8').replace(/\r\n?/g, '\n');
const expected = expectedHeaders();
if (checkMode) {
  if (current !== expected) {
    console.error('ERROR — _headers no coincide con las CSP por ruta generadas. Ejecutá npm run build:csp.');
    process.exit(1);
  }
  console.log(`OK — CSP reproducible; fallback global completo + ${handlerHashes.length} handler(s) inline restringidos por hash en CSP por página.`);
} else {
  fs.writeFileSync(headersPath, expected, 'utf8');
  console.log(`CSP generada: fallback global completo; ${handlerHashes.length} handler(s) heredados autorizados por hash en políticas por página.`);
}
