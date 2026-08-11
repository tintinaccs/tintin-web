const LAYOUT_CSS_VERSION = 'tintin-20260810-global-layout-2';
let loaded = false;

function ensureCss() {
  if (document.getElementById('tt-global-layout-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-global-layout-css';
  link.rel = 'stylesheet';
  link.href = `css/components/navigation/compartido/apariencia-global.css?v=${LAYOUT_CSS_VERSION}`;
  document.head.appendChild(link);
}

function safeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

function safeText(value, fallback, max = 80) {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return clean || fallback;
}

function safeImage(value) {
  const src = String(value || '').trim();
  if (/^assets-tintin\/[A-Za-z0-9_./-]+$/.test(src)) return src;
  if (/^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_./,%~-]+$/i.test(src)) return src;
  return '';
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
}

function setDesktopShopLabel(value) {
  document.querySelectorAll('[data-shell-route="shop"]').forEach(node => {
    const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.nodeValue = `${value} `;
    else node.insertBefore(document.createTextNode(`${value} `), node.firstChild);
  });
  setText('#btn-tablet-tienda > span:first-child', value);
}

function setOptionalRoute(route, label, visible) {
  document.querySelectorAll(`[data-shell-route="${route}"]`).forEach(node => {
    node.hidden = visible === false;
    if (visible !== false) node.textContent = label;
  });
}

function setMobileLabel(tab, label) {
  document.querySelectorAll(`[data-shell-tab="${tab}"]`).forEach(node => {
    const labels = [...node.querySelectorAll(':scope > span')].filter(span => !span.classList.contains('tt-cart-badge'));
    const target = labels.at(-1);
    if (target) target.textContent = label;
    node.setAttribute('aria-label', label);
  });
}

function setMobileVisibility(tab, visible) {
  document.querySelectorAll(`[data-shell-tab="${tab}"]`).forEach(node => { node.hidden = visible === false; });
}

function setCustomColor(root, attribute, cssVar, value) {
  const color = safeColor(value);
  root.toggleAttribute(attribute, Boolean(color));
  if (color) root.style.setProperty(cssVar, color);
  else root.style.removeProperty(cssVar);
}

function setDirectColor(selector, property, value) {
  const color = safeColor(value);
  document.querySelectorAll(selector).forEach(node => {
    if (color) node.style.setProperty(property, color, 'important');
    else node.style.removeProperty(property);
  });
}

function applyHeader(raw = {}) {
  const root = document.documentElement;
  root.dataset.ttHeaderDensity = ['compact', 'normal', 'roomy'].includes(raw.density) ? raw.density : 'normal';
  root.dataset.ttHeaderNavStyle = ['default', 'minimal', 'pills'].includes(raw.navStyle) ? raw.navStyle : 'default';
  root.dataset.ttHeaderLogoSize = ['small', 'medium', 'large'].includes(raw.logoSize) ? raw.logoSize : 'medium';
  setCustomColor(root, 'data-tt-header-bg-custom', '--tt-global-header-bg', raw.background);
  setCustomColor(root, 'data-tt-header-text-custom', '--tt-global-header-text', raw.textColor);
  setCustomColor(root, 'data-tt-header-accent-custom', '--tt-global-header-accent', raw.accentColor);
  setDirectColor('#tt-header-desktop-tablet,#tt-header-tablet,#tt-tablet-menu,#tt-tabbar', 'background-color', raw.background);
  setDirectColor('#tt-header-desktop-tablet,#tt-header-tablet,#tt-tablet-menu,#tt-tabbar', 'color', raw.textColor);

  const brandName = safeText(raw.brandName, 'TINTÍN', 60);
  const brandTagline = safeText(raw.brandTagline, 'ACCESORIOS & RELOJES', 80);
  setText('.tt-header-brand-copy strong', brandName);
  setText('.tt-header-brand-copy small', brandTagline);

  const logo = safeImage(raw.logo);
  if (logo) {
    document.querySelectorAll('.tt-logo-img,.tt-tablet-logo-img,.tt-tablet-menu-logo-img').forEach(image => {
      image.src = logo;
      image.alt = `${brandName} ${brandTagline}`.trim();
    });
  }

  const homeVisible = raw.showHome !== false;
  const homeLabel = safeText(raw.homeLabel, 'INICIO', 40);
  const shopLabel = safeText(raw.shopLabel, 'TIENDA', 40);
  const aboutLabel = safeText(raw.aboutLabel, 'NOSOTROS', 40);
  const contactLabel = safeText(raw.contactLabel, 'CONTACTO', 40);
  setOptionalRoute('home', homeLabel, homeVisible);
  setDesktopShopLabel(shopLabel);
  setOptionalRoute('about', aboutLabel, raw.showAbout !== false);
  setOptionalRoute('contact', contactLabel, raw.showContact !== false);
  setMobileLabel('home', homeLabel.charAt(0) + homeLabel.slice(1).toLowerCase());
  setMobileLabel('shop', shopLabel.charAt(0) + shopLabel.slice(1).toLowerCase());
  setMobileLabel('search', safeText(raw.searchLabel, 'Buscar', 40));
  setMobileLabel('cart', safeText(raw.cartLabel, 'Carrito', 40));
  setMobileLabel('account', safeText(raw.accountLabel, 'Cuenta', 40));
  setMobileVisibility('home', homeVisible);
  root.dataset.ttMobileHome = homeVisible ? 'visible' : 'hidden';
}

function applyFooter(raw = {}) {
  const root = document.documentElement;
  root.dataset.ttFooterDensity = ['compact', 'normal', 'roomy'].includes(raw.density) ? raw.density : 'normal';
  root.dataset.ttFooterStyle = ['default', 'minimal', 'boxed'].includes(raw.style) ? raw.style : 'default';
  setCustomColor(root, 'data-tt-footer-bg-custom', '--tt-global-footer-bg', raw.background);
  setCustomColor(root, 'data-tt-footer-text-custom', '--tt-global-footer-text', raw.textColor);
  setCustomColor(root, 'data-tt-footer-accent-custom', '--tt-global-footer-accent', raw.accentColor);
  setDirectColor('.tt-footer', 'background-color', raw.background);
  setDirectColor('.tt-footer', 'color', raw.textColor);
  document.querySelectorAll('.tt-footer-wa').forEach(node => { node.hidden = raw.showWhatsapp === false; });
}

export function applyGlobalLayout(layout = {}) {
  ensureCss();
  applyHeader(layout.header || {});
  applyFooter(layout.footer || {});
  document.documentElement.dataset.ttGlobalLayout = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:global-layout-ready'));
}

// Se pide en paralelo con los assets del shell (ver entrada-navegacion-publica.js)
// y se aplica ANTES de insertar el header/footer reales en el DOM: si en cambio
// se aplicara después (como hacía loadGlobalLayout antes), el texto/colores/logo
// por defecto ya pintados se reemplazan en un segundo paso — un salto visual
// real que el navegador cuenta como CLS aunque el loader de página lo tape.
export async function fetchGlobalLayoutConfig() {
  if (loaded) return null;
  loaded = true;
  ensureCss();
  try {
    const response = await fetch('/api/visual-studio-global-public', { headers: { accept: 'application/json' } });
    const data = response.ok ? await response.json() : null;
    return data?.config?.layout || null;
  } catch {
    return null;
  }
}
