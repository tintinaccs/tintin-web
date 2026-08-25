#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260822-checkout-hardening-1';
const COLOR_FIRST_PAINT_VERSION = 'tintin-20260816-loader-shell-bridge-1';
const LOADER_VERSION = 'tintin-20260825-scroll-reveal-2';
const PANEL_COMPAT_VERSION = 'tintin-20260811-cls-desktop-stable-2';
const PUBLIC_SHELL_VERSION = 'tintin-20260824-header-logo-fallback-1';
const NAV_ENTRY_VERSION = 'tintin-20260824-header-logo-fallback-1';
const NAV_BARRIER_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const VISUAL_BUILDER_VERSION = 'tintin-20260821-layout-stable-1';
const SESSION_PROTECTION_VERSION = 'tintin-20260822-dob-username-onboarding-1';
const PROFILE_GATE_VERSION = 'tintin-20260822-dob-username-onboarding-1';
const NAV_HEADER_VERSION = 'tintin-20260824-header-responsive-sync-1';
const NAV_SHARED_VERSION = 'tintin-20260818-header-dropdowns-solid-3';
const NAVIGATION_PRELOAD_STYLES = [
  ['css/components/navigation/escritorio/encabezado-escritorio.css', NAV_HEADER_VERSION],
  ['css/components/navigation/tableta/encabezado-tableta.css', NAV_HEADER_VERSION],
  ['css/components/navigation/movil/encabezado-movil.css', NAV_HEADER_VERSION],
  ['css/components/navigation/compartido/transiciones-navegacion.css', NAV_SHARED_VERSION],
  ['css/components/navigation/compartido/paneles.css', NAV_SHARED_VERSION],
  ['css/components/navigation/compartido/busqueda.css', NAV_SHARED_VERSION],
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
      ([href, version]) => `<link rel="preload" as="style" href="${href}?v=${version}">`
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

function versionVisualBuilder(html) {
  return html.replace(
    /(<script\b[^>]*src=["']js\/visual-builder-bootstrap\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi,
    `$1?v=${VISUAL_BUILDER_VERSION}$2`
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
  html = versionVisualBuilder(html);
  html = versionSessionProtection(html);
  html = versionProfileGate(html);
  html = normalizeWhitespace(html);

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`synced ${page}`);
  }
}

for (const page of fs.readdirSync(ROOT).filter(file => file.endsWith('.html') && !PUBLIC_PAGES.includes(file))) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  const html = versionVisualBuilder(versionProfileGate(versionSessionProtection(before)));
  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`session version synced ${page}`);
  }
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
