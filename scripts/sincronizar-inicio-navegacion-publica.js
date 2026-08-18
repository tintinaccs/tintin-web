#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260817-mobile-accordion-2';
const COLOR_FIRST_PAINT_VERSION = 'tintin-20260816-loader-shell-bridge-1';
const LOADER_VERSION = 'tintin-20260816-loader-min-show-1';
const PANEL_COMPAT_VERSION = 'tintin-20260811-cls-desktop-stable-2';
const PUBLIC_SHELL_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const NAV_ENTRY_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const NAV_BARRIER_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const SESSION_PROTECTION_VERSION = 'tintin-20260815-profile-routes-1';
const PROFILE_GATE_VERSION = 'tintin-20260815-profile-routes-1';
// Debe coincidir con SHELL_VERSION en js/components/navigation/compartido/configuracion.js:
// esa constante decide la URL exacta (con ?v=) que entrada-navegacion-publica.js y
// ensureNavigationAssets() piden en tiempo de ejecución. Si difieren, el preload no
// acierta la cache key exacta y el navegador vuelve a pedir el recurso igual.
const NAV_SHELL_VERSION = 'tintin-20260818-header-dropdowns-solid-2';
const NAVIGATION_PRELOAD_STYLES = [
  'css/components/navigation/escritorio/encabezado-escritorio.css',
  'css/components/navigation/tableta/encabezado-tableta.css',
  'css/components/navigation/movil/encabezado-movil.css',
  'css/components/navigation/compartido/transiciones-navegacion.css',
  'css/components/navigation/compartido/paneles.css',
  'css/components/navigation/compartido/busqueda.css',
];
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
  'account-drawer',
  'collections-sheet',
  'sheet-backdrop',
  'tt-shared-backdrop',
  'tt-shared-morph',
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
  const tokens = /(<link\b[^>]*href=["']css\/tokens-tintin\.css[^"']*["'][^>]*>)/i;
  if (tokens.test(html)) {
    return html.replace(tokens, `$1\n  <link rel="stylesheet" href="styles.css?v=${VERSION}">`);
  }
  return html.replace('</head>', `  <link rel="stylesheet" href="styles.css?v=${VERSION}">\n</head>`);
}

function ensureNavigationPreloads(html) {
  let out = html.replace(
    /\s*<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']js\/components\/navigation\/(?:entrada-navegacion-publica|compartido\/barrera-arranque-shell)\.js[^"']*["'][^>]*>/gi,
    ''
  );
  out = out.replace(
    /\s*<link\b[^>]*rel=["']preload["'][^>]*href=["']css\/components\/navigation\/[^"']*["'][^>]*>/gi,
    ''
  );

  const preloadTags = [
    `<link rel="modulepreload" href="js/components/navigation/compartido/barrera-arranque-shell.js?v=${NAV_BARRIER_VERSION}">`,
    `<link rel="modulepreload" href="js/components/navigation/entrada-navegacion-publica.js?v=${NAV_ENTRY_VERSION}">`,
    ...NAVIGATION_PRELOAD_STYLES.map(
      href => `<link rel="preload" as="style" href="${href}?v=${NAV_SHELL_VERSION}">`
    ),
  ].map(tag => `  ${tag}`).join('\n');

  const anchor = /(<link\b[^>]*href=["']js\/core\/store-gate\/nucleo-control-tienda\.js[^"']*["'][^>]*>)/i;
  if (anchor.test(out)) return out.replace(anchor, `$1\n${preloadTags}`);

  const firebaseAnchor = /(<link\b[^>]*href=["']js\/core\/firebase\/firebase\.js[^"']*["'][^>]*>)/i;
  if (firebaseAnchor.test(out)) return out.replace(firebaseAnchor, `$1\n${preloadTags}`);

  return out.replace('</head>', `${preloadTags}\n</head>`);
}

function ensureShellScript(html) {
  let out = html
    .replace(/\s*<script\b[^>]*src=["']js\/(?:surface-controller|ui-navigation-controller)\.js[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/\s*<script\b[^>]*src=["']js\/inicio-navegacion-publica\.js[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/\s*<script\b[^>]*src=["']js\/components\/navigation\/compatibilidad\/(?:inicio-control-paneles|retencion-cargador-shell)\.js[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/\s*<script\b[^>]*data-tt-shell-startup-hold[^>]*>[\s\S]*?<\/script>/gi, '');
  const loader = /(<script\b[^>]*src=["']js\/cargador-pagina\.js[^"']*["'][^>]*><\/script>)/i;
  if (!loader.test(out)) throw new Error('La pagina no carga js/cargador-pagina.js');

  // La espera temprana del shell se arma desde esquema-color-instantaneo.js,
  // que ya es parte del camino crítico permitido y corre antes del loader.
  // Así no agregamos otro request bloqueante ni scripts inline (importante para
  // la CSP del 404), mientras inicio-navegacion-publica.js puede seguir defer.
  return out.replace(loader, `$1\n  <script src="js/components/navigation/compatibilidad/inicio-control-paneles.js?v=${PANEL_COMPAT_VERSION}" defer></script>\n  <script src="js/inicio-navegacion-publica.js?v=${PUBLIC_SHELL_VERSION}" defer></script>`);
}

function centralizeRuntime(html) {
  let out = html.replace(
    /\s*<script\b[^>]*src=["']js\/(?:auth-nav|nav-collections|products-store|cart-sync)\.js[^"']*["'][^>]*><\/script>/gi,
    ''
  );
  if (!/<script\b[^>]*src=["']tienda\.js(?:\?|["'])/i.test(out)) {
    out = out.replace('</body>', `<script src="tienda.js?v=${VERSION}" defer></script>\n</body>`);
  } else {
    out = out.replace(/(<script\b[^>]*src=["']tienda\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi, `$1?v=${VERSION}$2`);
  }
  return out;
}

function versionFirstPaint(html) {
  return html.replace(
    /(<script\b[^>]*src=["']js\/components\/color\/esquema-color-instantaneo\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi,
    `$1?v=${COLOR_FIRST_PAINT_VERSION}$2`
  );
}

function versionRuntimeLoader(html) {
  return html.replace(
    /(<script\b[^>]*src=["']js\/cargador-pagina\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi,
    `$1?v=${LOADER_VERSION}$2`
  );
}

function versionSessionProtection(html) {
  return html.replace(
    /(js\/core\/auth\/proteccion-sesion\.js)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${SESSION_PROTECTION_VERSION}`
  );
}

function versionProfileGate(html) {
  return html.replace(
    /(js\/pages\/profile\/control-acceso-perfil\.js)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${PROFILE_GATE_VERSION}`
  );
}

function normalizeWhitespace(html) {
  return html
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/>\s+<script src="tienda\.js/g, '>\n<script src="tienda.js');
}

let changed = 0;
for (const page of PUBLIC_PAGES) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const before = html;

  for (const id of SHELL_IDS) html = removeElementById(html, id);
  html = removeLegacyComments(html);
  html = ensureStyles(html);
  html = ensureNavigationPreloads(html);
  html = ensureShellScript(html);
  html = centralizeRuntime(html);
  html = versionFirstPaint(html);
  html = versionRuntimeLoader(html);
  html = versionSessionProtection(html);
  html = versionProfileGate(html);
  html = normalizeWhitespace(html);

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`synced ${page}`);
  }
}

// Admin y cualquier otra superficie fuera del shell público también pueden
// cargar proteccion-sesion.js. Se sincroniza únicamente ese tag sin intentar
// insertar navegación pública en esas páginas.
for (const page of fs.readdirSync(ROOT).filter(file => file.endsWith('.html') && !PUBLIC_PAGES.includes(file))) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const html = versionProfileGate(versionSessionProtection(before));
  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`session version synced ${page}`);
  }
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
