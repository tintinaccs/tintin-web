#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260829-community-actions-1';
const COLOR_FIRST_PAINT_VERSION = 'tintin-20260816-loader-shell-bridge-1';
const LOADER_VERSION = 'tintin-20260825-scroll-reveal-2';
const PANEL_COMPAT_VERSION = 'tintin-20260811-cls-desktop-stable-2';
const PUBLIC_SHELL_VERSION = 'tintin-20260829-final-stability-1';
const NAV_ENTRY_VERSION = 'tintin-20260829-final-stability-1';
const NAV_BARRIER_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const VISUAL_BUILDER_VERSION = 'tintin-20260826-carousel-order-3';
const SESSION_PROTECTION_VERSION = 'tintin-20260829-persistent-session-1';
const PROFILE_GATE_VERSION = 'tintin-20260822-dob-username-onboarding-1';
const NAV_HEADER_VERSION = 'tintin-20260824-header-responsive-sync-1';
const NAV_SHARED_VERSION = 'tintin-20260825-responsive-css-budget-2';
const UNIFIED_THEME_VERSION = 'tintin-20260828-unified-footer-1';
const NAVIGATION_PRELOAD_STYLES = [
  ['css/components/navigation/escritorio/encabezado-escritorio.css', NAV_HEADER_VERSION, '(min-width: 1025px)'],
  ['css/components/navigation/tableta/encabezado-tableta.css', NAV_HEADER_VERSION, '(min-width: 768px) and (max-width: 1024px)'],
  ['css/components/navigation/movil/encabezado-movil.css', NAV_HEADER_VERSION, '(max-width: 767px)'],
  ['css/components/navigation/compartido/transiciones-navegacion.css', NAV_SHARED_VERSION, ''],
  ['css/components/navigation/compartido/paneles.css', NAV_SHARED_VERSION, ''],
  ['css/components/navigation/compartido/busqueda.css', NAV_SHARED_VERSION, ''],
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

function sharedFooter() {
  return `<!-- Footer público único: sincronizado por scripts/sincronizar-inicio-navegacion-publica.js -->
<footer class="tt-footer" data-tt-footer="unified" aria-label="Pie de página">
  <div class="container tt-footer-shell">
    <div class="tt-footer-grid">
      <div class="tt-footer-brand" aria-label="TINTIN Accesorios">
        <a href="/" class="tt-logo-link" aria-label="Ir al inicio de TINTIN">
          <img loading="lazy" decoding="async" src="assets-tintin/images/general/logo.png?v=tintin-20260715-15" alt="TINTIN" class="tt-logo-img tt-logo-img--menu">
        </a>
        <p class="tt-footer-tagline">Accesorios que acompañan tu brillo. Comprá online con atención cercana desde Paraguay.</p>
        <a href="https://wa.me/595981299331" target="_blank" rel="noopener" class="tt-footer-wa">
          <span aria-hidden="true">↗</span><span class="tt-footer-wa-text">Escribirnos por WhatsApp</span>
        </a>
      </div>

      <nav class="tt-footer-col" aria-label="Tienda">
        <div class="tt-footer-col-title">Tienda</div>
        <ul>
          <li><a href="/catalogo">Catálogo</a></li>
          <li><a href="/collections">Colecciones</a></li>
          <li><a href="/catalogo?cat=relojes">Relojes</a></li>
          <li><a href="/catalogo?cat=bolsos">Bags</a></li>
        </ul>
      </nav>

      <nav class="tt-footer-col" aria-label="Ayuda">
        <div class="tt-footer-col-title">Ayuda</div>
        <ul>
          <li><a href="/envios">Envíos</a></li>
          <li><a href="/cambios-devoluciones">Cambios y devoluciones</a></li>
          <li><a href="/preguntas-frecuentes">Preguntas frecuentes</a></li>
          <li><a href="/contact">Contacto</a></li>
        </ul>
      </nav>

      <nav class="tt-footer-col" aria-label="Tintin">
        <div class="tt-footer-col-title">Tintin</div>
        <ul>
          <li><a href="/about">Nosotros</a></li>
          <li><a href="/terminos">Términos</a></li>
          <li><a href="/privacidad">Privacidad</a></li>
        </ul>
      </nav>
    </div>

    <div class="tt-footer-bottom">
      <div class="tt-footer-contact">
        <a class="tt-contact-email" href="mailto:tintinaccs@gmail.com">tintinaccs@gmail.com</a>
        <span aria-hidden="true">·</span>
        <span class="tt-contact-addr">San Lorenzo, Paraguay</span>
      </div>
      <div class="tt-footer-copy">© <span data-current-year></span> Tintin Accesorios. Todos los derechos reservados.</div>
    </div>
  </div>
</footer>`;
}

function ensureFooter(html) {
  const footerStart = html.indexOf('<footer');
  const footerEnd = footerStart >= 0 ? html.indexOf('</footer>', footerStart) : -1;
  if (footerStart >= 0 && footerEnd >= 0) {
    return html.slice(0, footerStart) + sharedFooter() + html.slice(footerEnd + '</footer>'.length);
  }
  return html.replace(/<\/body>/i, `${sharedFooter()}\n</body>`);
}

function centralizeRuntime(html) {
  const runtimeTag = `<script defer src="tienda.js?v=${VERSION}"></script>`;
  html = html.replace(/\s*<script\s+defer\s+src=["']tienda\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${runtimeTag}\n</body>`);
}

function versionSessionProtection(html) {
  return html.replace(
    /js\/core\/auth\/proteccion-sesion\.js\?v=[A-Za-z0-9._-]+/g,
    `js/core/auth/proteccion-sesion.js?v=${SESSION_PROTECTION_VERSION}`
  );
}

function versionProfileGate(html) {
  return html.replace(
    /js\/core\/auth\/puerta-perfil\.js\?v=[A-Za-z0-9._-]+/g,
    `js/core/auth/puerta-perfil.js?v=${PROFILE_GATE_VERSION}`
  );
}

function ensurePreload(html, href, version, media = '') {
  const versionedHref = `${href}?v=${version}`;
  const escapedPath = escapeRegex(href);
  const existing = new RegExp(`<link\\s+[^>]*href=["']${escapedPath}\\?v=[^"']+["'][^>]*>`, 'gi');
  html = html.replace(existing, '');
  const mediaAttr = media ? ` media="${media}"` : '';
  const preload = `<link rel="preload" href="${versionedHref}" as="style"${mediaAttr}>`;
  return html.replace(/<\/head>/i, `  ${preload}\n</head>`);
}

function ensureNavigationStyles(html) {
  for (const [href, version, media] of NAVIGATION_PRELOAD_STYLES) {
    html = ensurePreload(html, href, version, media);
  }
  return html;
}

function versionBootstrap(html) {
  html = html.replace(
    /js\/inicio-navegacion-publica\.js\?v=[A-Za-z0-9._-]+/g,
    `js/inicio-navegacion-publica.js?v=${PUBLIC_SHELL_VERSION}`
  );
  return html;
}

function ensureUnifiedTheme(html) {
  const tag = `<link rel="stylesheet" href="css/theme/pulido-marca-responsive-tintin.css?v=${UNIFIED_THEME_VERSION}">`;
  html = html.replace(/\s*<link\s+rel=["']stylesheet["']\s+href=["']css\/theme\/pulido-marca-responsive-tintin\.css\?v=[^"']+["']\s*\/?>/gi, '');
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function ensureColorFirstPaint(html) {
  const tag = `<script src="js/components/color/esquema-color-instantaneo.js?v=${COLOR_FIRST_PAINT_VERSION}"></script>`;
  html = html.replace(/\s*<script\s+src=["']js\/components\/color\/esquema-color-instantaneo\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function ensureLoader(html) {
  const tag = `<script defer src="js/components/loader/cargador-pagina.js?v=${LOADER_VERSION}"></script>`;
  html = html.replace(/\s*<script\s+defer\s+src=["']js\/components\/loader\/cargador-pagina\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function ensureVisualBuilder(html) {
  const tag = `<script type="module" src="js/core/store/visual-builder-runtime.js?v=${VISUAL_BUILDER_VERSION}"></script>`;
  html = html.replace(/\s*<script\s+type=["']module["']\s+src=["']js\/core\/store\/visual-builder-runtime\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function ensurePanelCompatibility(html) {
  const tag = `<script type="module" src="js/components/navigation/compartido/compatibilidad-menus-desplegables.js?v=${PANEL_COMPAT_VERSION}"></script>`;
  html = html.replace(/\s*<script\s+type=["']module["']\s+src=["']js\/components\/navigation\/compartido\/compatibilidad-menus-desplegables\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function ensureBootstrap(html) {
  const tag = `<script defer src="js/inicio-navegacion-publica.js?v=${PUBLIC_SHELL_VERSION}"></script>`;
  html = html.replace(/\s*<script\s+defer\s+src=["']js\/inicio-navegacion-publica\.js\?v=[^"']+["']><\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function ensureYearRuntime(html) {
  const tag = `<script>document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = new Date().getFullYear(); });</script>`;
  html = html.replace(/\s*<script>document\.querySelectorAll\('\[data-current-year\]'\)[\s\S]*?<\/script>/gi, '');
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function processFile(file) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return false;
  const original = fs.readFileSync(fullPath, 'utf8');
  let html = original;
  for (const id of SHELL_IDS) html = removeElementById(html, id);
  html = removeLegacyComments(html);
  html = ensureFooter(html);
  html = centralizeRuntime(html);
  html = versionSessionProtection(html);
  html = versionProfileGate(html);
  html = ensureNavigationStyles(html);
  html = ensureUnifiedTheme(html);
  html = ensureColorFirstPaint(html);
  html = ensureLoader(html);
  html = ensureVisualBuilder(html);
  html = ensurePanelCompatibility(html);
  html = versionBootstrap(html);
  html = ensureBootstrap(html);
  html = ensureYearRuntime(html);

  if (html !== original) {
    fs.writeFileSync(fullPath, html, 'utf8');
    return true;
  }
  return false;
}

let changed = 0;
for (const page of PUBLIC_PAGES) {
  if (processFile(page)) changed += 1;
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
