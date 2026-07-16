#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260716-product-page-1';
const PUBLIC_PAGES = [
  '404.html',
  'about.html',
  'cambios-devoluciones.html',
  'catalogo.html',
  'checkout.html',
  'collections.html',
  'contact.html',
  'envios.html',
  'index.html',
  'login.html',
  'perfil.html',
  'preguntas-frecuentes.html',
  'privacidad.html',
  'product.html',
  'terminos.html',
];

const SHELL_IDS = [
  'tt-header-desktop-tablet',
  'search-panel',
  'mobile-menu',
  'tt-tabbar',
  'cart-overlay',
  'cart-drawer',
  'collections-sheet',
  'sheet-backdrop',
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeElementById(html, id) {
  const opener = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bid=["']${escapeRegex(id)}["'][^>]*>`, 'i');
  const match = opener.exec(html);
  if (!match) return html;

  const tag = match[1];
  const token = new RegExp(`<\\/?${escapeRegex(tag)}\\b[^>]*>`, 'gi');
  token.lastIndex = match.index;
  let depth = 0;
  let part;

  while ((part = token.exec(html))) {
    const closing = /^<\//.test(part[0]);
    const selfClosing = /\/>$/.test(part[0]);
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;
    if (depth === 0) return html.slice(0, match.index) + html.slice(token.lastIndex);
  }

  throw new Error(`No se encontro el cierre de #${id}`);
}

function removeLegacyComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, comment => {
    const marker = comment.slice(4, -3).replace(/[═─\s]/g, ' ').trim().toUpperCase();
    const legacyMarkers = new Set([
      'HEADER', 'MOBILE MENU OVERLAY', 'MOBILE TABBAR', 'CART DRAWER',
      'MOBILE COLLECTIONS BOTTOM SHEET',
    ]);
    return legacyMarkers.has(marker) ? '' : comment;
  });
}

function ensureStyles(html) {
  if (/href=["']styles\.css(?:\?|["'])/i.test(html)) return html;
  const tokens = /(<link\b[^>]*href=["']css\/tintin-tokens\.css[^"']*["'][^>]*>)/i;
  if (tokens.test(html)) {
    return html.replace(tokens, `$1\n  <link rel="stylesheet" href="styles.css?v=${VERSION}">`);
  }
  return html.replace('</head>', `  <link rel="stylesheet" href="styles.css?v=${VERSION}">\n</head>`);
}

function ensureShellScript(html) {
  let out = html.replace(/\s*<script\b[^>]*src=["']js\/public-shell\.js[^"']*["'][^>]*><\/script>/gi, '');
  const loader = /(<script\b[^>]*src=["']js\/page-loader\.js[^"']*["'][^>]*><\/script>)/i;
  if (!loader.test(out)) throw new Error('La pagina no carga js/page-loader.js');
  return out.replace(loader, `$1\n  <script src="js/public-shell.js?v=${VERSION}" defer></script>`);
}

function centralizeRuntime(html) {
  let out = html.replace(
    /\s*<script\b[^>]*src=["']js\/(?:auth-nav|nav-collections|products-store|cart-sync)\.js[^"']*["'][^>]*><\/script>/gi,
    ''
  );
  if (!/<script\b[^>]*src=["']script\.js(?:\?|["'])/i.test(out)) {
    out = out.replace('</body>', `<script src="script.js?v=${VERSION}" defer></script>\n</body>`);
  }
  return out;
}

function normalizeWhitespace(html) {
  return html
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/>\s+<script src="script\.js/g, '>\n<script src="script.js');
}

let changed = 0;
for (const page of PUBLIC_PAGES) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const before = html;

  for (const id of SHELL_IDS) html = removeElementById(html, id);
  html = removeLegacyComments(html);
  html = ensureStyles(html);
  html = ensureShellScript(html);
  html = centralizeRuntime(html);
  html = normalizeWhitespace(html);

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`synced ${page}`);
  }
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
