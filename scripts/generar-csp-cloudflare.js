'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const headersPath = path.join(root, '_headers');
const originConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/origenes-tintin.json'), 'utf8'));
const publicOrigin = String(originConfig.publicOrigin || '').replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(publicOrigin)) throw new Error('publicOrigin inválido en config/origenes-tintin.json');

const startMarker = '# CSP_ROUTE_POLICIES_START';
const endMarker = '# CSP_ROUTE_POLICIES_END';
const scriptOrigins = "https://*.gstatic.com https://*.google.com https://unpkg.com https://www.googletagmanager.com";
const connectOrigins = "https://*.googleapis.com https://*.google.com https://*.gstatic.com https://unpkg.com https://*.googleusercontent.com https://res.cloudinary.com https://api.cloudinary.com https://api.imgbb.com https://*.google-analytics.com https://*.analytics.google.com";

const VISUAL_BUILDER_PREVIEWABLE_PAGES = new Set([
  'index.html', 'about.html', 'catalogo.html', 'collections.html',
  'contact.html', 'envios.html', 'preguntas-frecuentes.html', 'cambios-devoluciones.html',
  'product.html', 'terminos.html', 'privacidad.html', '404.html',
]);

function inlineHashes(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n?/g, '\n');
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    hashes.add(`'sha256-${crypto.createHash('sha256').update(match[2], 'utf8').digest('base64')}'`);
  }
  return [...hashes].sort();
}

function allInlineHashes() {
  const hashes = new Set();
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    inlineHashes(file).forEach(hash => hashes.add(hash));
  }
  return [...hashes].sort();
}

function globalPolicy() {
  const hashes = allInlineHashes();
  return [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''} ${scriptOrigins}`,
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${connectOrigins}`,
    `frame-src 'self' ${publicOrigin} https://*.google.com https://*.gstatic.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join('; ') + ';';
}

function pagePolicy(file) {
  const hashes = inlineHashes(file);
  return [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''} ${scriptOrigins}`,
    "script-src-attr 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${connectOrigins}`,
    `frame-src 'self' ${publicOrigin} https://*.google.com https://*.gstatic.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${VISUAL_BUILDER_PREVIEWABLE_PAGES.has(file) ? "'self'" : "'none'"}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join('; ') + ';';
}

function generateRouteBlock() {
  const files = fs.readdirSync(root).filter(name => name.endsWith('.html')).sort();
  const blocks = [];
  for (const file of files) {
    const route = file === 'index.html' ? '/' : `/${path.basename(file, '.html')}`;
    const policy = pagePolicy(file);
    blocks.push(`${route}\n  Content-Security-Policy: ${policy}`);
    if (file === 'index.html') {
      blocks.push(`${publicOrigin}/\n  Content-Security-Policy: ${policy}`);
    }
  }
  return `${startMarker}\n# Generado por scripts/generar-csp-cloudflare.js; no editar a mano.\n${blocks.join('\n\n')}\n${endMarker}`;
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
if (process.argv.includes('--check')) {
  if (current !== expected) {
    console.error('ERROR — _headers no coincide con las CSP por ruta generadas. Ejecutá npm run build:csp.');
    process.exit(1);
  }
  console.log('OK — CSP de Cloudflare reproducible y actualizada.');
} else {
  fs.writeFileSync(headersPath, expected, 'utf8');
  console.log('CSP de Cloudflare generada por ruta.');
}
