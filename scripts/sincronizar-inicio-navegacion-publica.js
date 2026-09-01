#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'tintin-20260831-product-loading-4';
const COLOR_FIRST_PAINT_VERSION = 'tintin-20260816-loader-shell-bridge-1';
const LOADER_VERSION = 'tintin-20260830-store-gate-api-1';
const STORE_GATE_VERSION = 'tintin-20260830-store-gate-api-1';
const PANEL_COMPAT_VERSION = 'tintin-20260811-cls-desktop-stable-2';
const PUBLIC_SHELL_VERSION = 'tintin-20260901-notification-badge-unified-1';
const NAV_ENTRY_VERSION = 'tintin-20260901-notification-badge-unified-1';
const NAV_BARRIER_VERSION = 'tintin-20260816-loader-shell-atomic-1';
const VISUAL_BUILDER_VERSION = 'tintin-20260826-carousel-order-3';
const SESSION_PROTECTION_VERSION = 'tintin-20260901-superadmin-profile-gate-1';
const PROFILE_GATE_VERSION = 'tintin-20260901-username-visible-1';
const NAV_HEADER_VERSION = 'tintin-20260824-header-responsive-sync-1';
const NAV_SHARED_VERSION = 'tintin-20260825-responsive-css-budget-2';
const UNIFIED_THEME_VERSION = 'tintin-20260901-footer-light-1';
const NAVIGATION_PRELOAD_STYLES = [
  ['css/components/navigation/escritorio/encabezado-escritorio.css', NAV_HEADER_VERSION, '(min-width: 1025px)'],
  ['css/components/navigation/tableta/encabezado-tableta.css', NAV_HEADER_VERSION, '(min-width: 768px) and (max-width: 1024px)'],
  ['css/components/navigation/movil/encabezado-movil.css', NAV_HEADER_VERSION, '(max-width: 767px)'],
  ['css/components/navigation/compartido/transiciones-navegacion.css', NAV_SHARED_VERSION, ''],
  ['css/components/navigation/compartido/paneles.css', NAV_SHARED_VERSION, ''],
  ['css/components/navigation/compartido/busqueda.css', NAV_SHARED_VERSION, ''],
];
const PUBLIC_PAGES = [
  // 404.html se excluye a propósito: Cloudflare Pages la sirve verbatim en
  // cualquier profundidad de ruta no encontrada, así que sus assets usan
  // rutas absolutas (/js/..., /styles.css...) en vez de las relativas que
  // este generador produce para el resto de páginas públicas. Sincronizarla
  // aquí revertiría ese fix y duplicaría scripts del shell.
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

      <nav class="tt-footer-col" aria-label="Más información">
        <div class="tt-footer-col-title">Más información</div>
        <ul>
          <li><a href="/about">Quiénes somos</a></li>
          <li><a href="/envios">Envíos</a></li>
          <li><a href="/cambios-devoluciones">Cambios y devoluciones</a></li>
          <li><a href="/preguntas-frecuentes">Preguntas frecuentes</a></li>
          <li><a href="/terminos">Términos y condiciones</a></li>
          <li><a href="/privacidad">Privacidad</a></li>
          <li><a href="/sitemap.xml">Mapa del sitio</a></li>
        </ul>
      </nav>

      <nav class="tt-footer-col tt-footer-contact" aria-label="Contacto">
        <div class="tt-footer-col-title">Contacto</div>
        <ul>
          <li><a href="/contact">Atención al cliente</a></li>
          <li><a href="tel:+595981299331" class="tt-contact-phone">+595 981 299 331</a></li>
          <li><a href="mailto:tintinaccs@gmail.com" class="tt-contact-email">tintinaccs@gmail.com</a></li>
          <li><a href="https://instagram.com/tintinaccs" target="_blank" rel="noopener">@tintinaccs</a></li>
          <li class="tt-contact-addr">Paraguay</li>
        </ul>
      </nav>
    </div>
  </div>
  <div class="tt-footer-bottom">© 2024-2026 TINTIN ACCESORIOS · TODOS LOS DERECHOS RESERVADOS</div>
</footer>`;
}

function replaceSharedFooter(html) {
  const opener = /<footer\b[^>]*\bclass=["'][^"']*\btt-footer\b[^"']*["'][^>]*>/i;
  const match = opener.exec(html);
  const footerMarker = /(?:\s*<!-- Footer público único: sincronizado por scripts\/sincronizar-inicio-navegacion-publica\.js -->)+\s*$/;
  if (!match) return html.replace('</body>', `${sharedFooter()}\n</body>`);

  const token = /<\/?footer\b[^>]*>/gi;
  token.lastIndex = match.index;
  let depth = 0;
  let part;
  while ((part = token.exec(html))) {
    if (/^<\//.test(part[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      const beforeFooter = html.slice(0, match.index).replace(footerMarker, '\n');
      return beforeFooter + sharedFooter() + html.slice(token.lastIndex);
    }
  }
  throw new Error('No se encontró el cierre del footer .tt-footer.');
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
      ([href, version, media]) => `<link rel="preload" as="style"${media ? ` media="${media}"` : ''} href="${href}?v=${version}">`
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

function versionStoreGate(html) {
  return html.replace(
    /(js\/core\/store-gate\/nucleo-control-tienda\.js)(?:\?[^"']*)?/gi,
    `$1?v=${STORE_GATE_VERSION}`
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

function versionUnifiedTheme(html) {
  return html.replace(
    /(css\/core\/tema-unificado-tintin\.css)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${UNIFIED_THEME_VERSION}`
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
  html = replaceSharedFooter(html);
  html = ensureStyles(html);
  html = ensureNavigationPreloads(html);
  html = ensureShellScript(html);
  html = centralizeRuntime(html);
  html = versionFirstPaint(html);
  html = versionRuntimeLoader(html);
  html = versionStoreGate(html);
  html = versionVisualBuilder(html);
  html = versionSessionProtection(html);
  html = versionProfileGate(html);
  html = versionUnifiedTheme(html);
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
  const html = versionUnifiedTheme(versionVisualBuilder(versionProfileGate(versionSessionProtection(before))));
  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`session version synced ${page}`);
  }
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
