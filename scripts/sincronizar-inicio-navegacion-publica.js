#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('parse5');
const { renderMobileBrandHeader } = require('../js/components/navigation/movil/marca-movil.js');
const { LOGO_VERSION } = require('../js/components/navigation/compartido/configuracion.js');
const { CATEGORIES } = require('../js/components/navigation/compartido/iconos.js');
const { restoreStyleSources, writeHomeStyles } = require('./lib/estilos-inicio.js');

const ROOT = path.resolve(__dirname, '..');
const ABOUT_STYLES = { id: 'tt-about-css-bundle', file: 'css/generated/nosotros.css', versionPrefix: 'tintin-about' };
const VERSION = 'tintin-20261010-social-mobile-styles-3';
const SECONDARY_LAYOUT_VERSION = 'tintin-20260916-final-production-stability-secondary-layout-1-palette-20261014-1';
const QUALITY_INTERFACE_VERSION = 'tintin-20260916-final-production-stability-quality-2-palette-20261014-1';
const TIENDA_VERSION = 'tintin-20261024-editor-v2-4';
const COLOR_FIRST_PAINT_VERSION = 'tintin-20261022-avatar-inicial-1';
const LOADER_VERSION = 'tintin-20261023-editor-audit-1';
const STORE_GATE_VERSION = 'tintin-20261017-domain-cutover-1';
const PANEL_COMPAT_VERSION = 'tintin-20261023-header-dropup-2';
const PUBLIC_SHELL_VERSION = 'tintin-20261024-editor-v2-4';
const NAV_ENTRY_VERSION = 'tintin-20261024-editor-v2-4';
const NAV_BARRIER_VERSION = 'tintin-20260915-session-shell-2';
const VISUAL_BUILDER_VERSION = 'tintin-20261023-variant-engine-v2-2';
const SESSION_PROTECTION_VERSION = 'tintin-20261022-avatar-inicial-1';
const PROFILE_GATE_VERSION = 'tintin-20261022-avatar-inicial-1';
const NAV_HEADER_VERSION = 'tintin-20261010-whatsapp-release-5-palette-20261014-1-logos-bottom-20261015-1';
const NAV_TABLET_VERSION = 'tintin-20261010-whatsapp-release-5-palette-20261014-1-logos-bottom-20261015-1';
const NAV_MOBILE_VERSION = 'tintin-20261010-mobile-single-selection-2-palette-20261014-1';
const UNIFIED_THEME_VERSION = 'tintin-20261021-commerce-review-1';
const NAVIGATION_PRELOAD_STYLES = [
  ['css/components/navigation/escritorio/encabezado-escritorio.css', NAV_HEADER_VERSION, '(min-width: 1025px)'],
  ['css/components/navigation/tableta/encabezado-tableta.css', NAV_TABLET_VERSION, '(min-width: 768px) and (max-width: 1024px)'],
  ['css/components/navigation/movil/encabezado-movil.css', NAV_MOBILE_VERSION, '(max-width: 767px)'],
];
// Estas hojas definen geometría y superficies reales. Descubrirlas sólo desde
// un import posterior al Store Gate provocaba una segunda cascada visible.
const PUBLIC_STRUCTURAL_STYLES = [
  ['tt-responsive-brand-surfaces-css', 'css/theme/superficies-marca-responsive-tintin.css', 'tintin-20260909-account-drawer-polish-1-brand-20261004-1-owner-pink-20261004-1-loads-20261007-1-master-20261007-1-encomienda-20261008-1-checkout-20261008-2-palette-20261014-1'],
  ['tt-responsive-brand-polish-css', 'css/theme/pulido-marca-responsive-tintin.css', 'tintin-20260903-loader-white-brand-2-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1'],
  ['tt-responsive-brand-safety-css', 'css/theme/seguridad-marca-responsive-tintin.css', 'tintin-20260803-brand-safety-1-brand-20261004-1-owner-pink-20261004-1-first-render-merge-20261010-1-palette-20261014-1'],
  ['tt-global-layout-css', 'css/components/navigation/compartido/apariencia-global.css', 'tintin-20260817-footer-contrast-1-brand-20261004-1-owner-pink-20261004-1-footer-gradient-20261016-1'],
  ['tt-phase8-ui-ux-css', 'css/quality/experiencia-interfaz.css', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2-palette-20261014-1'],
];

const PUBLIC_PAGE_STYLES = {
  'contact.html': ['css/pages/contacto.css'],
  'terminos.html': ['css/pages/legal.css'],
  'privacidad.html': ['css/pages/legal.css'],
  'checkout.html': ['css/pages/checkout-confiabilidad.css'],
};

function ensureSectionFlow(html, absolute = false) {
  const ranges = [];
  function visit(node) {
    if (node.tagName === 'script' && node.attrs.some(attr => attr.name === 'id' && attr.value === 'tt-section-flow-runtime')) {
      const location = node.sourceCodeLocation;
      if (location) {
        let start = location.startOffset;
        while (start > 0 && /\s/.test(html[start - 1])) start -= 1;
        ranges.push([start, location.endOffset]);
      }
    }
    node.childNodes?.forEach(visit);
    if (node.content) visit(node.content);
  }
  visit(parse(html, { sourceCodeLocationInfo: true }));
  let out = html;
  ranges.sort((a, b) => b[0] - a[0]).forEach(([start, end]) => { out = out.slice(0, start) + out.slice(end); });
  if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(out)) return out;
  const beforeHeadEnd = out.slice(0, out.indexOf('</head>'));
  const join = beforeHeadEnd.endsWith('\n') ? '' : '\n';
  return out.replace('</head>', `${join}  <script id="tt-section-flow-runtime" src="${absolute ? '/' : ''}js/theme/alternancia-secciones.js?v=tintin-20261023-global-layout-1" defer></script>\n</head>`);
}
function ensurePublicStructuralStyles(html, absolute = false, page = '') {
  let out = ensureSectionFlow(html, absolute).replace(/\s*<!-- Estructura pública disponible desde el primer render -->/g, '');
  for (const [id] of PUBLIC_STRUCTURAL_STYLES) {
    out = out.replace(new RegExp(`\\s*<link\\b[^>]*id=["']${id}["'][^>]*>`, 'gi'), '');
  }
  out = out.replace(/\s*<link\b[^>]*data-tt-page-structure=["']initial["'][^>]*>/gi, '');
  const links = PUBLIC_STRUCTURAL_STYLES.map(([id, href, version]) =>
    `  <link id="${id}" rel="stylesheet" href="${absolute ? '/' : ''}${href}?v=${version}">`
  ).concat((PUBLIC_PAGE_STYLES[page] || []).map(href =>
    `  <link data-tt-page-structure="initial" rel="stylesheet" href="${href}?v=tintin-20261010-first-render-merge-1-palette-20261014-1">`
  )).join('\n');
  return out.replace('</head>', `  <!-- Estructura pública disponible desde el primer render -->\n${links}\n</head>`);
}
// Hojas que los runtimes agregaban después de mostrar el contenido.
// Conservamos sus versiones y selectores para que reutilicen el link inicial.
const INITIAL_SHARED_STYLES = [
  [
    "id=\"tt-phase10-accessibility-css\"",
    "css/quality/accesibilidad-global.css",
    "tintin-20261013-connectivity-hit-target-1-palette-20261014-1"
  ]
];
const INITIAL_PUBLIC_STYLES = [
  ['id="tt-mobile-brand-css"', 'css/components/navigation/movil/marca-movil.css', 'tintin-20261023-global-layout-1'],
  [
    "id=\"tt-global-studio-runtime-css\"",
    "css/components/visual-studio-global-runtime.css",
    "tintin-20260810-global-studio-4-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
  ],
  [
    "id=\"tt-visual-builder-runtime-css\"",
    "css/components/editor-visual-runtime.css",
    "tintin-20260810-visual-studio-v2-8-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
  ],
  [
    "id=\"tt-navigation-notifications-css\" data-tt-social-notifications=\"1\"",
    "css/components/notifications/notificaciones-sociales.css",
    "tintin-20260925-cache-converge-1-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
  ],
  [
    "id=\"tt-navigation-desktop-css\" media=\"(min-width: 1025px)\"",
    "css/components/navigation/escritorio/encabezado-escritorio.css",
    "tintin-20261010-whatsapp-release-5-palette-20261014-1-logos-bottom-20261015-1"
  ],
  [
    "id=\"tt-navigation-tablet-css\" media=\"(min-width: 768px) and (max-width: 1024px)\"",
    "css/components/navigation/tableta/encabezado-tableta.css",
    "tintin-20261010-whatsapp-release-5-palette-20261014-1-logos-bottom-20261015-1"
  ],
  [
    "id=\"tt-navigation-mobile-css\" media=\"(max-width: 767px)\"",
    "css/components/navigation/movil/encabezado-movil.css",
    "tintin-20261010-mobile-single-selection-2-palette-20261014-1"
  ],
  [
    "id=\"tt-navigation-mobile-solid-css\" media=\"(max-width: 767px)\"",
    "css/components/navigation/movil/fondos-solidos-movil.css",
    "tintin-20260817-cls-desktop-stable-3-checkout-20261008-2-palette-20261014-1"
  ],
  [
    "id=\"tt-navigation-shared-css\"",
    "css/components/navigation/compartido/transiciones-navegacion.css",
    "tintin-20260921-document-navigation-no-view-transition-css-1-brand-20261004-1-owner-pink-20261004-1"
  ],
  [
    "id=\"tt-surface-controller-css\"",
    "css/components/navigation/compartido/paneles.css",
    "tintin-20260916-surface-z-index-fallback-1-brand-20261004-1-owner-pink-20261004-1-domain-prepared-20261012-6-palette-20261014-1"
  ],
  [
    "id=\"tt-navigation-notification-surface-css\"",
    "css/components/navigation/compartido/superficie-notificaciones.css",
    "tintin-20260918-header-system-solid-surfaces-1"
  ],
  [
    "id=\"tt-navigation-search-css\"",
    "css/components/navigation/compartido/busqueda.css",
    "tintin-20261023-search-panel-height-1"
  ],
  [
    "id=\"tt-navigation-coherence-css\"",
    "css/components/navigation/compartido/coherencia-visual.css",
    "tintin-20261023-header-dropup-4"
  ]
];
const INITIAL_PAGE_STYLES = {
  "index.html": [
    [
      "id=\"tt-home-maintenance-css\"",
      "css/pages/home/mantenimiento-inicio.css",
      "tintin-20261019-footer-spacing-1"
    ]
  ],
  "catalogo.html": [
    [
      "data-tt-catalog-maintenance=\"1\"",
      "css/pages/catalog/catalog-maintenance.css",
      "tintin-20261023-global-layout-2"
    ]
  ],
  "about.html": [
    [
      "data-tt-about-maintenance=\"1\"",
      "css/pages/institutional/about-maintenance.css",
      "tintin-20261016-story-d0a8aa1277"
    ]
  ],
  "checkout.html": [
    [
      "data-tt-checkout-maintenance=\"1\"",
      "css/pages/checkout/checkout-maintenance.css",
      "tintin-20261023-checkout-header-clearance-1"
    ],
    [
      "id=\"tt-payment-methods-style\"",
      "css/components/payments/payment-methods.css",
      "tintin-20261012-checkout-ready-3-payment-methods-css-palette-20261014-1"
    ]
  ],
  "login.html": [
    [
      "data-tt-login-maintenance=\"1\"",
      "css/pages/login/login-maintenance.css",
      "tintin-20261021-workspace-account-1"
    ],
    [
      "data-tt-login-fluid=\"1\"",
      "css/pages/login/login-fluid-responsive.css",
      "tintin-20260803-login-fluid-1-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
    ],
    [
      "data-tt-login-onboarding-flow=\"1\"",
      "css/pages/login/login-onboarding-flow.css",
      "tintin-20261001-registration-white-cards-2-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
    ],
    [
      "data-tt-login-onboarding-layout=\"1\"",
      "css/pages/login/login-onboarding-form-layout.css",
      "tintin-20261021-workspace-account-1"
    ]
  ],
  "admin.html": [
    [
      "data-adm-social-notifications=\"1\"",
      "css/admin/notificaciones-admin.css",
      "tintin-20260925-cache-converge-notifications-auto-read-1-brand-20261004-1-owner-pink-20261004-1-palette-20261014-1"
    ]
  ]
};

function addInitialClass(html, tag, name) {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>`, 'i'), opener => {
    const match = opener.match(/\bclass=["']([^"']*)["']/i);
    if (match) {
      if (match[1].split(/\s+/).includes(name)) return opener;
      return opener.replace(match[0], `class="${match[1]} ${name}"`);
    }
    return opener.replace(/>$/, ` class="${name}">`);
  });
}

function ensureInitialRuntimeStyles(html, page) {
  // Los stubs sólo redirigen; no tienen una interfaz que preparar.
  if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html)) return html;
  const isPublic = PUBLIC_PAGES.includes(page) || page === '404.html';
  if (!isPublic && !['admin.html', 'admin-images.html'].includes(page)) return html;
  let out = html;
  const styles = [...INITIAL_SHARED_STYLES, ...(isPublic ? INITIAL_PUBLIC_STYLES : []), ...(INITIAL_PAGE_STYLES[page] || [])];
  const links = [];
  for (const [attribute, file, version] of styles) {
    const pattern = new RegExp(`\\s*<link\\b[^>]*href=["']/?${escapeRegex(file)}(?:\\?[^"']*)?["'][^>]*>`, 'gi');
    out = out.replace(pattern, '');
    const link = `  <link ${attribute} rel="stylesheet" href="${page === '404.html' ? '/' : ''}${file}?v=${version}">`;
    if (file === 'css/components/navigation/movil/fondos-solidos-movil.css') {
      const loaderStyle = /\s*<link\b[^>]*href=["']\/?css\/theme\/fondo-solido-cargador\.css[^"']*["'][^>]*>/i;
      if (loaderStyle.test(out)) {
        out = out.replace(loaderStyle, tag => `\n${link}\n  ${tag.trim()}`);
        continue;
      }
    }
    links.push(link);
  }
  out = out.replace('</head>', `${links.join('\n')}\n</head>`);
  out = addInitialClass(out, 'html', 'tt-parity-safe');
  if (page === 'catalogo.html') out = addInitialClass(out, 'body', 'tt-catalog-maintenance');
  if (page === 'about.html') {
    out = addInitialClass(out, 'html', 'tt-about-maintained');
    out = addInitialClass(out, 'body', 'tt-about-maintained');
  }
  return out;
}

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

// Repite el reemplazo hasta que el texto deja de cambiar: un borrado de una
// sola pasada puede dejar fragmentos que vuelven a formar la etiqueta.
function replaceUntilStable(text, pattern, replacement) {
  let previous;
  let out = text;
  do {
    previous = out;
    out = out.replace(pattern, replacement);
  } while (out !== previous);
  return out;
}

function removeLegacyComments(html) {
  return replaceUntilStable(html, /<!--[\s\S]*?-->/g, comment => {
    const marker = comment.slice(4, -3).replace(/[═─\s]/g, ' ').trim().toUpperCase();
    const legacyMarkers = new Set([
      'HEADER', 'MOBILE MENU OVERLAY', 'MOBILE TABBAR', 'CART DRAWER',
      'MOBILE COLLECTIONS BOTTOM SHEET',
    ]);
    return legacyMarkers.has(marker) ? '' : comment;
  });
}

function ensureMobileBrandHeader(html, page) {
  html = removeElementById(html, 'tt-mobile-brand');
  if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html)) return html;
  const brand = renderMobileBrandHeader(page, `/assets-tintin/images/general/logo.png?v=${LOGO_VERSION}`);
  if (!brand) return html;
  let bodyEnd = null;
  const visit = node => {
    if (node.tagName === 'body') bodyEnd = node.sourceCodeLocation?.startTag?.endOffset;
    node.childNodes?.forEach(visit);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  if (bodyEnd == null) throw new Error(`No se encontró el body real de ${page}`);
  return html.slice(0, bodyEnd) + `\n${brand}` + html.slice(bodyEnd).replace(/^\s*/, '\n');
}

function sharedFooter(absoluteAssets = false) {
  return `<!-- Footer público único: sincronizado por scripts/sincronizar-inicio-navegacion-publica.js -->
<footer class="tt-footer" data-tt-footer="unified" aria-label="Pie de página">
  <div class="container tt-footer-shell">
    <div class="tt-footer-grid">
      <div class="tt-footer-brand" aria-label="TINTIN Accesorios">
        <a href="/" class="tt-logo-link" aria-label="Ir al inicio de TINTIN">
          <img loading="lazy" decoding="async" src="${absoluteAssets ? '/' : ''}assets-tintin/images/general/logo.png?v=tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2" alt="TINTIN" class="tt-logo-img tt-logo-img--menu">
        </a>
        <p class="tt-footer-tagline">Tu tienda de accesorios y relojes en Paraguay. Comprá online con atención cercana.</p>
        <p class="tt-footer-hours">Horario de atención: 09:00 a 22:00 hs.</p>
        <a href="https://wa.me/595981299331" target="_blank" rel="noopener" class="tt-footer-wa">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.65 15.02L2 22l5.1-1.34A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.08-1.12l-.36-.21-3 .79.8-2.92-.24-.38A8 8 0 1 1 12 20Zm4.38-5.97c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.2-.72-.64-1.2-1.44-1.35-1.68-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.8-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.19.86 2.33.98 2.49.12.16 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.52.1.46-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg><span class="tt-footer-wa-text">Escribir por WhatsApp</span>
        </a>
      </div>

      <nav class="tt-footer-col" aria-label="Tienda">
        <div class="tt-footer-col-title">Tienda</div>
        <ul data-collections-nav="footer">
          <li data-footer-catalog><a href="/catalogo">Catálogo</a></li>
${CATEGORIES.map(({ slug, label }) => `          <li><a href="/catalogo?cat=${encodeURIComponent(slug)}">${label}</a></li>`).join('\n')}
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

function replaceSharedFooter(html, absoluteAssets = false) {
  const opener = /<footer\b[^>]*\bclass=["'][^"']*\btt-footer\b[^"']*["'][^>]*>/i;
  const match = opener.exec(html);
  const footerMarker = /(?:\s*<!-- Footer público único: sincronizado por scripts\/sincronizar-inicio-navegacion-publica\.js -->)+\s*$/;
  if (!match) return html.replace('</body>', `${sharedFooter(absoluteAssets)}\n</body>`);

  const token = /<\/?footer\b[^>]*>/gi;
  token.lastIndex = match.index;
  let depth = 0;
  let part;
  while ((part = token.exec(html))) {
    if (/^<\//.test(part[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      const beforeFooter = html.slice(0, match.index).replace(footerMarker, '\n');
      return beforeFooter + sharedFooter(absoluteAssets) + html.slice(token.lastIndex);
    }
  }
  throw new Error('No se encontró el cierre del footer .tt-footer.');
}

function removeSharedFooter(html) {
  return html.replace(
    /\s*<!-- Footer público único: sincronizado por scripts\/sincronizar-inicio-navegacion-publica\.js -->\s*<footer\b[^>]*\btt-footer\b[^>]*>[\s\S]*?<\/footer>\s*/i,
    '\n'
  );
}

function ensureStyles(html) {
  const existing = /(<link\b[^>]*href=["'])(\/?styles\.css)(\?[^"']*)?(["'][^>]*>)/i;
  if (existing.test(html)) {
    html = html.replace(existing, `$1styles.min.css?v=${VERSION}$4`);
  }
  if (!/href=["']\/?styles\.min\.css\?v=/i.test(html)) {
    const tokens = /(<link\b[^>]*href=["']css\/tokens-tintin\.css[^"']*["'][^>]*>)/i;
    if (tokens.test(html)) {
      html = html.replace(tokens, `$1\n  <link rel="stylesheet" href="styles.min.css?v=${VERSION}">`);
    } else {
      html = html.replace('</head>', `  <link rel="stylesheet" href="styles.min.css?v=${VERSION}">\n</head>`);
    }
  }
  let seen = 0;
  return html.replace(/\s*<link\b[^>]*href=["']\/?styles\.min\.css\?v=[^"']+["'][^>]*>/gi, tag => {
    seen += 1;
    return seen === 1 ? tag : '';
  });
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
  let out = html;
  for (const pattern of [
    /\s*<script\b[^>]*src=["']js\/(?:surface-controller|ui-navigation-controller)\.js[^"']*["'][^>]*><\/script\s*>/gi,
    /\s*<script\b[^>]*src=["']js\/inicio-navegacion-publica\.js[^"']*["'][^>]*><\/script\s*>/gi,
    /\s*<script\b[^>]*src=["']js\/components\/navigation\/compatibilidad\/(?:inicio-control-paneles|retencion-cargador-shell)\.js[^"']*["'][^>]*><\/script\s*>/gi,
    /\s*<script\b[^>]*data-tt-shell-startup-hold[^>]*>[\s\S]*?<\/script\s*>/gi,
  ]) out = replaceUntilStable(out, pattern, '');
  const loader = /(<script\b[^>]*src=["']\/?js\/cargador-pagina\.js[^"']*["'][^>]*><\/script>)/i;
  if (!loader.test(out)) throw new Error('La pagina no carga js/cargador-pagina.js');

  return out.replace(loader, `$1\n  <script src="js/components/navigation/compatibilidad/inicio-control-paneles.js?v=${PANEL_COMPAT_VERSION}" defer></script>\n  <script src="js/inicio-navegacion-publica.js?v=${PUBLIC_SHELL_VERSION}" defer></script>`);
}

function centralizeRuntime(html) {
  let out = replaceUntilStable(
    html,
    /\s*<script\b[^>]*src=["']js\/(?:auth-nav|nav-collections|products-store|cart-sync)\.js[^"']*["'][^>]*><\/script\s*>/gi,
    ''
  );
  if (!/<script\b[^>]*src=["']tienda\.js(?:\?|["'])/i.test(out)) {
    out = out.replace('</body>', `<script src="tienda.js?v=${TIENDA_VERSION}" defer></script>\n</body>`);
  } else {
    out = out.replace(/(<script\b[^>]*src=["']tienda\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi, `$1?v=${TIENDA_VERSION}$2`);
  }
  // Todas las tarjetas comparten la misma autoridad de fotos y paleta.
  // Los scripts defer conservan este orden antes del renderer clásico.
  if (!out.includes('src="js/components/images/galeria-producto.js?')) {
    out = out.replace(/<script\b[^>]*src=["']tienda\.js[^"']*["'][^>]*><\/script>/i, tag => `<script src="js/components/images/galeria-producto.js?v=tintin-20261019-variant-links-1" defer></script>\n${tag}`);
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
    /(<script\b[^>]*src=["']\/?js\/cargador-pagina\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi,
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
    /(["'](?:\.\/|\/)?js\/pages\/profile\/control-acceso-perfil\.js)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${PROFILE_GATE_VERSION}`
  );
}

function versionUnifiedTheme(html) {
  return html.replace(
    /(css\/core\/tema-unificado-tintin\.css)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${UNIFIED_THEME_VERSION}`
  );
}

function versionSecondaryLayout(html) {
  return html.replace(
    /(css\/pages\/secundarias-minimal\.css)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${SECONDARY_LAYOUT_VERSION}`
  );
}

function versionQualityInterface(html) {
  return html.replace(
    /(css\/quality\/calidad-interfaz\.css)(?:\?v=[A-Za-z0-9._-]+)?/gi,
    `$1?v=${QUALITY_INTERFACE_VERSION}`
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

  if (page === 'index.html') html = restoreStyleSources(html);
  if (page === 'about.html') html = restoreStyleSources(html, ABOUT_STYLES.id);

  for (const id of SHELL_IDS) html = removeElementById(html, id);
  html = removeLegacyComments(html);
  // Login es una pantalla de acceso aislada: no comparte el pie público.
  html = page === 'login.html' ? removeSharedFooter(html) : replaceSharedFooter(html);
  html = ensureMobileBrandHeader(html, page);
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
  html = versionSecondaryLayout(html);
  html = versionQualityInterface(html);
  html = ensurePublicStructuralStyles(html, false, page);
  html = ensureInitialRuntimeStyles(html, page);
  html = normalizeWhitespace(html);
  if (page === 'index.html') html = writeHomeStyles(html, ROOT);
  if (page === 'about.html') html = writeHomeStyles(html, ROOT, ABOUT_STYLES);

  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`synced ${page}`);
  }
}

for (const page of fs.readdirSync(ROOT).filter(file => file.endsWith('.html') && !PUBLIC_PAGES.includes(file))) {
  const file = path.join(ROOT, page);
  const before = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  let html = versionUnifiedTheme(versionVisualBuilder(versionProfileGate(versionSessionProtection(before))));
  html = versionRuntimeLoader(html);
  html = ensureSectionFlow(html, page === '404.html');
  if (page === '404.html') {
    html = replaceSharedFooter(html, true);
    html = ensureMobileBrandHeader(html, page);
    html = html.replace(/(\/?js\/inicio-navegacion-publica\.js)\?v=[A-Za-z0-9._-]+/g, `$1?v=${PUBLIC_SHELL_VERSION}`);
    html = html.replace(/(\/?js\/components\/navigation\/entrada-navegacion-publica\.js)\?v=[A-Za-z0-9._-]+/g, `$1?v=${NAV_ENTRY_VERSION}`);
    html = html.replace(/(\b(?:src|href)=["'])(?=(?:js|css|assets-tintin)\/)/g, '$1/');
    html = ensurePublicStructuralStyles(html, true);
    html = html.replace(/(<script\b[^>]*src=["']\/tienda\.js)(?:\?[^"']*)?(["'][^>]*><\/script>)/gi, `$1?v=${TIENDA_VERSION}$2`);
  }
  html = ensureInitialRuntimeStyles(html, page);
  if (html !== before) {
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
    console.log(`session version synced ${page}`);
  }
}

console.log(`Public shell sync completed. Changed files: ${changed}`);
