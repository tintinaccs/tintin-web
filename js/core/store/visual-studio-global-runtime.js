const GLOBAL_RUNTIME_VERSION = 'tintin-20260810-global-studio-3';
const PAGE_BY_FILE = Object.freeze({
  '': 'index', 'index.html': 'index', 'about.html': 'nosotros', 'nosotros.html': 'nosotros',
  'catalogo.html': 'catalogo', 'collections.html': 'collections', 'product.html': 'product', 'checkout.html': 'checkout',
  'login.html': 'login', 'perfil.html': 'perfil', 'contact.html': 'contact', 'envios.html': 'envios',
  'preguntas-frecuentes.html': 'faq', 'cambios-devoluciones.html': 'cambios', 'terminos.html': 'terminos',
  'privacidad.html': 'privacidad', '404.html': '404',
});
const MODAL_KINDS = new Set(['center', 'bottom-sheet']);
let initialized = false;
let activePopupCleanup = null;

function currentPageId() {
  const file = location.pathname.split('/').filter(Boolean).at(-1) || '';
  return PAGE_BY_FILE[file] || (location.pathname === '/' ? 'index' : '');
}
function currentDevice() {
  if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
  return 'desktop';
}
function activeWindow(item, now = Date.now()) {
  if (!item?.enabled) return false;
  const start = item.startAt ? new Date(item.startAt).getTime() : -Infinity;
  const end = item.endAt ? new Date(item.endAt).getTime() : Infinity;
  if ((!Number.isFinite(start) && start !== -Infinity) || (!Number.isFinite(end) && end !== Infinity)) return false;
  return now >= start && now <= end;
}
function highest(items) {
  return [...items].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(b.startAt || '').localeCompare(String(a.startAt || '')))[0] || null;
}
function ensureCss() {
  if (document.getElementById('tt-global-studio-runtime-css')) return;
  const link = document.createElement('link');
  link.id = 'tt-global-studio-runtime-css'; link.rel = 'stylesheet';
  link.href = `css/components/visual-studio-global-runtime.css?v=${GLOBAL_RUNTIME_VERSION}`;
  document.head.appendChild(link);
}
function storageGet(storage, key) { try { return storage?.getItem(key) || ''; } catch { return ''; } }
function storageSet(storage, key, value) { try { storage?.setItem(key, value); } catch {} }
function paraguayDayKey() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}
function frequencyKey(popup) { return `tt_visual_popup_${popup.id}`; }
function alreadySeen(popup) {
  const key = frequencyKey(popup);
  if (popup.frequency === 'session') return storageGet(window.sessionStorage, key) === '1';
  if (popup.frequency === 'daily') return storageGet(window.localStorage, key) === paraguayDayKey();
  if (popup.frequency === 'once') return storageGet(window.localStorage, key) === '1';
  return false;
}
function markSeen(popup) {
  const key = frequencyKey(popup);
  if (popup.frequency === 'session') storageSet(window.sessionStorage, key, '1');
  else if (popup.frequency === 'daily') storageSet(window.localStorage, key, paraguayDayKey());
  else if (popup.frequency === 'once') storageSet(window.localStorage, key, '1');
}
function matchesPopup(popup) {
  if (!activeWindow(popup) || alreadySeen(popup)) return false;
  const page = currentPageId(); const device = currentDevice();
  if (!page || (!popup.pages?.includes('*') && !popup.pages?.includes(page))) return false;
  if (Array.isArray(popup.devices) && !popup.devices.includes(device)) return false;
  if (popup.trigger === 'exit' && device !== 'desktop') return false;
  const params = new URLSearchParams(location.search);
  if (page === 'product' && popup.productIds?.length) {
    const id = String(params.get('id') || '').trim().toLowerCase(); if (!id || !popup.productIds.includes(id)) return false;
  }
  if (['catalogo', 'collections'].includes(page) && popup.categories?.length) {
    const category = String(params.get('cat') || params.get('category') || '').trim().toLowerCase();
    if (!category || !popup.categories.includes(category)) return false;
  }
  return true;
}
function make(tag, className = '', text = '') {
  const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
}

function renderCampaign(config) {
  const campaign = highest((config.campaigns || []).filter(item => activeWindow(item)));
  document.querySelectorAll('[data-tt-global-campaign]').forEach(node => node.remove());
  document.querySelectorAll('[data-tt-global-effects]').forEach(node => node.remove());
  document.documentElement.removeAttribute('data-tt-global-campaign-active');
  if (!campaign) return;
  document.documentElement.dataset.ttGlobalCampaignActive = campaign.id;
  document.documentElement.style.setProperty('--tt-global-campaign-accent', campaign.accentColor || '#ad3f67');

  if (campaign.announcement && storageGet(window.sessionStorage, `tt_campaign_bar_${campaign.id}`) !== 'closed') {
    const bar = make('div', 'tt-global-campaign-bar'); bar.dataset.ttGlobalCampaign = campaign.id;
    if (campaign.background) bar.style.setProperty('--tt-global-bg', campaign.background);
    if (campaign.textColor) bar.style.setProperty('--tt-global-text', campaign.textColor);
    if (campaign.accentColor) bar.style.setProperty('--tt-global-accent', campaign.accentColor);
    const label = campaign.href ? make('a', '', campaign.announcement) : make('span', '', campaign.announcement);
    if (campaign.href) label.href = campaign.href; bar.appendChild(label);
    if (campaign.closable !== false) {
      const close = make('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar anuncio');
      close.addEventListener('click', () => { storageSet(window.sessionStorage, `tt_campaign_bar_${campaign.id}`, 'closed'); bar.remove(); }); bar.appendChild(close);
    }
    document.body.prepend(bar);
  }
  renderEffect(campaign);
}

function renderEffect(campaign) {
  if (!campaign.effect || campaign.effect === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = make('div', 'tt-global-effects'); layer.dataset.ttGlobalEffects = campaign.id; layer.setAttribute('aria-hidden', 'true');
  const count = campaign.intensity === 'high' ? 32 : campaign.intensity === 'low' ? 12 : 20;
  const glyphs = { hearts: '♥', snow: '❄', sparkles: '✦' };
  for (let index = 0; index < count; index += 1) {
    const particle = make('span', `tt-global-effect-particle tt-global-effect-${campaign.effect}`, glyphs[campaign.effect] || '');
    particle.style.setProperty('--tt-x', `${Math.random() * 100}%`);
    particle.style.setProperty('--tt-size', `${12 + Math.random() * 15}px`);
    particle.style.setProperty('--tt-opacity', `${0.35 + Math.random() * 0.5}`);
    particle.style.setProperty('--tt-duration', `${7 + Math.random() * 8}s`);
    particle.style.setProperty('--tt-delay', `${-Math.random() * 12}s`);
    particle.style.setProperty('--tt-drift', `${-45 + Math.random() * 90}px`);
    particle.style.setProperty('--tt-particle-color', campaign.accentColor || `hsl(${Math.round(Math.random() * 360)} 75% 62%)`);
    layer.appendChild(particle);
  }
  document.body.appendChild(layer);
}

function focusables(root) {
  return [...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
}
function showPopup(popup) {
  if (document.querySelector('[data-tt-global-popup]')) return;
  markSeen(popup);
  const backdrop = make('div', 'tt-global-popup-backdrop'); backdrop.dataset.kind = popup.kind; backdrop.dataset.ttGlobalPopup = popup.id;
  const panel = make('section', 'tt-global-popup'); panel.dataset.animation = popup.animation || 'fade'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', popup.name || popup.title || 'Aviso');
  const isModal = MODAL_KINDS.has(popup.kind); if (isModal) panel.setAttribute('aria-modal', 'true');
  if (popup.background) panel.style.setProperty('--tt-popup-bg', popup.background);
  if (popup.textColor) panel.style.setProperty('--tt-popup-text', popup.textColor);
  if (popup.accentColor) panel.style.setProperty('--tt-popup-accent', popup.accentColor);
  const close = make('button', 'tt-global-popup-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar aviso'); panel.appendChild(close);
  if (popup.image) { const image = make('img', 'tt-global-popup-image'); image.src = popup.image; image.alt = popup.imageAlt || ''; image.loading = 'lazy'; image.decoding = 'async'; panel.appendChild(image); }
  if (popup.title) panel.appendChild(make('h2', '', popup.title));
  if (popup.text) panel.appendChild(make('p', '', popup.text));
  if (popup.buttonLabel && popup.href) { const action = make('a', 'tt-global-popup-action', popup.buttonLabel); action.href = popup.href; panel.appendChild(action); }
  backdrop.appendChild(panel); document.body.appendChild(backdrop);

  const previousFocus = document.activeElement; const previousOverflow = document.documentElement.style.overflow;
  if (isModal) document.documentElement.style.overflow = 'hidden';
  const closePopup = () => {
    if (!backdrop.isConnected) return; backdrop.remove();
    if (isModal) document.documentElement.style.overflow = previousOverflow;
    document.removeEventListener('keydown', onKeyDown); activePopupCleanup = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  };
  const onKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closePopup(); return; }
    if (!isModal || event.key !== 'Tab') return;
    const items = focusables(panel); if (!items.length) { event.preventDefault(); panel.focus(); return; }
    const first = items[0]; const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  close.addEventListener('click', closePopup); backdrop.addEventListener('click', event => { if (isModal && event.target === backdrop) closePopup(); });
  document.addEventListener('keydown', onKeyDown); activePopupCleanup = closePopup;
  window.setTimeout(() => close.focus({ preventScroll: true }), 0);
}

function schedulePopup(config) {
  const eligible = (config.popups || []).filter(matchesPopup); const popup = highest(eligible); if (!popup) return;
  const fire = () => showPopup(popup);
  if (popup.trigger === 'immediate') { window.setTimeout(fire, 80); return; }
  if (popup.trigger === 'delay') { window.setTimeout(fire, Math.max(0, Number(popup.triggerValue || 0)) * 1000); return; }
  if (popup.trigger === 'scroll') {
    const handler = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); const percent = scrollY / max * 100;
      if (percent >= Number(popup.triggerValue || 40)) { window.removeEventListener('scroll', handler); fire(); }
    };
    window.addEventListener('scroll', handler, { passive: true }); handler(); return;
  }
  if (popup.trigger === 'exit') {
    const handler = event => { if (event.clientY > 4) return; document.removeEventListener('mouseout', handler); fire(); };
    document.addEventListener('mouseout', handler);
  }
}

export function applyGlobalVisualStudio(config = {}) {
  ensureCss(); renderCampaign(config); schedulePopup(config);
  document.documentElement.dataset.ttGlobalStudio = 'ready';
  window.dispatchEvent(new CustomEvent('tintin:global-visual-studio-ready'));
}

export async function initGlobalVisualStudio() {
  if (initialized) return; initialized = true;
  if (new URLSearchParams(location.search).get('ttVisualPreview') === '1' && window.parent !== window) return;
  ensureCss();
  try {
    const response = await fetch('/api/visual-studio-global-public', { headers: { accept: 'application/json' } });
    const data = response.ok ? await response.json() : null;
    if (data?.config) applyGlobalVisualStudio(data.config); else document.documentElement.dataset.ttGlobalStudio = 'fallback';
  } catch { document.documentElement.dataset.ttGlobalStudio = 'fallback'; }
}

export function disposeGlobalVisualStudio() {
  activePopupCleanup?.(); activePopupCleanup = null;
  document.querySelectorAll('[data-tt-global-campaign],[data-tt-global-effects],[data-tt-global-popup]').forEach(node => node.remove());
  document.documentElement.removeAttribute('data-tt-global-studio'); document.documentElement.removeAttribute('data-tt-global-campaign-active');
}
