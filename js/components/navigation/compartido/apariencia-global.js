const LAYOUT_CSS_VERSION = 'tintin-20260810-global-layout-1';
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

function applyHeader(raw = {}) {
  const root = document.documentElement;
  const background = safeColor(raw.background);
  const textColor = safeColor(raw.textColor);
  const accentColor = safeColor(raw.accentColor);
  root.dataset.ttHeaderDensity = ['compact', 'normal', 'roomy'].includes(raw.density) ? raw.density : 'normal';
  root.dataset.ttHeaderNavStyle = ['default', 'minimal', 'pills'].includes(raw.navStyle) ? raw.navStyle : 'default';
  root.dataset.ttHeaderLogoSize = ['small', 'medium', 'large'].includes(raw.logoSize) ? raw.logoSize : 'medium';
  if (background) root.style.setProperty('--tt-global-header-bg', background); else root.style.removeProperty('--tt-global-header-bg');
  if (textColor) root.style.setProperty('--tt-global-header-text', textColor); else root.style.removeProperty('--tt-global-header-text');
  if (accentColor) root.style.setProperty('--tt-global-header-accent', accentColor); else root.style.removeProperty('--tt-global-header-accent');

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

  const homeLabel = safeText(raw.homeLabel, 'INICIO', 40);
  const shopLabel = safeText(raw.shopLabel, 'TIENDA', 40);
  const aboutLabel = safeText(raw.aboutLabel, 'NOSOTROS', 40);
  const contactLabel = safeText(raw.contactLabel, 'CONTACTO', 40);
  setOptionalRoute('home', homeLabel, raw.showHome !== false);
  setDesktopShopLabel(shopLabel);
  setOptionalRoute('about', aboutLabel, raw.showAbout !== false);
  setOptionalRoute('contact', contactLabel, raw.showContact !== false);
  setMobileLabel('home', homeLabel.charAt(0) + homeLabel.slice(1).toLowerCase());
  setMobileLabel('shop', shopLabel.charAt(0) + shopLabel.slice(1).toLowerCase());
  setMobileLabel('search', safeText(raw.searchLabel, 'Buscar', 40));
  setMobileLabel('cart', safeText(raw.cartLabel, 'Carrito', 40));
  setMobileLabel('account', safeText(raw.accountLabel, 'Cuenta', 40));
}

function applyFooter(raw = {}) {
  const root = document.documentElement;
  const background = safeColor(raw.background);
  const textColor = safeColor(raw.textColor);
  const accentColor = safeColor(raw.accentColor);
  root.dataset.ttFooterDensity = ['compact', 'normal', 'roomy'].includes(raw.density) ? raw.density : 'normal';
  root.dataset.ttFooterStyle = ['default', 'minimal', 'boxed'].includes(raw.style) ? raw.style : 'default';
  if (background) root.style.setProperty('--tt-global-footer-bg', background); else root.style.removeProperty('--tt-global-footer-bg');
  if (textColor) root.style.setProperty('--tt-global-footer-text', textColor); else root.style.removeProperty('--tt-global-footer-text');
  if (accentColor) root.style.setProperty('--tt-global-footer-accent', accentColor); else root.style.removeProperty('--tt-global-footer-accent');
  document.querySelectorAll('.tt-footer-wa').forEach(node => { node.hidden = raw.showWhatsapp === false; });
}

export function applyGlobalLayout(layout = {}) {
  ensureCss();
  applyHeader(layout.header || {});
  applyFooter(layout.footer || {});
  document.documentElement.dataset.ttGlobalLayout = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:global-layout-ready'));
}

async function loadGlobalLayout() {
  if (loaded) return;
  loaded = true;
  try {
    const response = await fetch('/api/visual-studio-global-public', { headers: { accept: 'application/json' } });
    const data = response.ok ? await response.json() : null;
    if (data?.config?.layout) applyGlobalLayout(data.config.layout);
    else document.documentElement.dataset.ttGlobalLayout = 'fallback';
  } catch {
    document.documentElement.dataset.ttGlobalLayout = 'fallback';
  }
}

export function initGlobalNavigationAppearance() {
  ensureCss();
  if (document.body?.classList.contains('tt-public-shell-mounted')) {
    void loadGlobalLayout();
    return;
  }
  document.addEventListener('tintin:public-shell-ready', () => { void loadGlobalLayout(); }, { once: true });
}

initGlobalNavigationAppearance();
