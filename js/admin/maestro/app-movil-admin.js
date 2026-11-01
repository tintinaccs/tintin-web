// App móvil del panel (≤768px). Capa de presentación e interacción: no toca
// permisos, sesión, datos ni controladores de negocio. Reutiliza la navegación
// real (botones de pestaña → switchSection) y AdminUnsaved para borradores.
const APP_QUERY = matchMedia('(max-width: 768px)');
const root = document.documentElement;
const PRIMARY = new Set(['dashboard', 'pedidos', 'productos', 'usuarios']);
const OVERLAYS = {
  'order-edit-overlay': 'closeOrderEdit',
  'client-ficha-overlay': 'closeClientFicha',
  'tpl-edit-overlay': 'closeTplEdit',
  'tpl-preview-overlay': 'closeTplPreview',
  'promo-confirm-overlay': 'closePromoConfirm'
};

const isApp = () => APP_QUERY.matches;
const shown = node => !!node && node.style.display !== 'none' && getComputedStyle(node).display !== 'none';

// ── Modo app y sección activa ──
function activeSection() {
  return document.querySelector('.adm-content > .adm-section.active')?.id.replace(/^section-/, '') || 'dashboard';
}
function syncSection() {
  const section = activeSection();
  if (document.body.dataset.admSection !== section) document.body.dataset.admSection = section;
  root.classList.toggle('adm-app-has-back', isApp() && !PRIMARY.has(section));
}
function syncMode() {
  root.classList.toggle('adm-app', isApp());
  syncSection();
  if (!isApp()) closeSheet();
}
APP_QUERY.addEventListener('change', syncMode);

const content = document.querySelector('.adm-content');
if (content) {
  const sectionObserver = new MutationObserver(syncSection);
  const watch = node => { if (node instanceof Element && node.matches('.adm-section')) sectionObserver.observe(node, { attributes: true, attributeFilter: ['class'] }); };
  content.querySelectorAll(':scope > .adm-section').forEach(watch);
  new MutationObserver(records => { records.forEach(r => r.addedNodes.forEach(watch)); syncSection(); }).observe(content, { childList: true });
}

// ── Volver ──
const title = document.querySelector('.adm-topbar-title');
if (title && !document.getElementById('adm-app-back')) {
  const back = document.createElement('button');
  back.type = 'button';
  back.id = 'adm-app-back';
  back.className = 'adm-app-back';
  back.setAttribute('aria-label', 'Volver');
  back.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg><span>Volver</span>';
  back.addEventListener('click', () => {
    // Con historial propio del panel, Volver = Atrás del navegador (pasa por
    // la guardia de cambios). Si se entró directo, vuelve a "Más".
    if (Number(history.state?.ttAdminIndex) > 0) history.back();
    else document.getElementById('adm-mobile-more-toggle')?.click();
  });
  title.prepend(back);
}

// ── Atrás del navegador cierra la ventana a pantalla completa abierta ──
let ignorePop = 0, overlayHref = '';
const overlayOpen = id => shown(document.getElementById(id));
function pushOverlay(id) {
  if (history.state?.ttAppOverlay === id) return;
  overlayHref = location.href;
  history.pushState({ ...history.state, ttAppOverlay: id }, '', location.href);
}
function onOverlayChange(id) {
  if (!isApp()) return;
  if (overlayOpen(id)) pushOverlay(id);
  else if (history.state?.ttAppOverlay === id && location.href === overlayHref) { ignorePop++; history.back(); }
}
for (const id of Object.keys(OVERLAYS)) {
  const node = document.getElementById(id);
  if (node) new MutationObserver(() => onOverlayChange(id)).observe(node, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
}
window.addEventListener('popstate', () => {
  if (ignorePop) { ignorePop--; return; }
  if (!isApp()) return;
  if (sheetOpen()) closeSheet(false);
  const id = Object.keys(OVERLAYS).find(overlayOpen);
  if (!id || history.state?.ttAppOverlay === id) return;
  window[OVERLAYS[id]]?.();
  // Si la guardia de cambios pide confirmar y se cancela, la ventana sigue
  // abierta: se restaura su entrada para que Atrás vuelva a cerrarla.
  const unsaved = document.getElementById('unsaved-modal');
  const settle = () => {
    if (shown(unsaved)) { setTimeout(settle, 150); return; }
    if (overlayOpen(id)) pushOverlay(id);
  };
  setTimeout(settle, 0);
});

// ── Hoja inferior reutilizable (filtros) ──
// Mueve nodos existentes (con sus eventos) a la hoja y los devuelve a su
// lugar al cerrar, así los filtros reales siguen funcionando igual.
let sheet, sheetBackdrop, sheetBody, sheetTitle, sheetOpener, moved = [];
function ensureSheet() {
  if (sheet) return;
  sheetBackdrop = document.createElement('div');
  sheetBackdrop.className = 'adm-app-sheet-backdrop';
  sheetBackdrop.hidden = true;
  sheet = document.createElement('section');
  sheet.className = 'adm-app-sheet';
  sheet.id = 'adm-app-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'adm-app-sheet-title');
  sheet.hidden = true;
  sheet.innerHTML = '<div class="adm-mobile-more-handle" aria-hidden="true"></div><div class="adm-app-sheet-head"><h2 id="adm-app-sheet-title"></h2><button type="button" class="adm-app-sheet-done">Listo</button></div><div class="adm-app-sheet-body"></div>';
  sheetBody = sheet.querySelector('.adm-app-sheet-body');
  sheetTitle = sheet.querySelector('#adm-app-sheet-title');
  sheet.querySelector('.adm-app-sheet-done').addEventListener('click', () => closeSheet());
  sheetBackdrop.addEventListener('click', () => closeSheet());
  sheet.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); closeSheet(); } });
  document.body.append(sheetBackdrop, sheet);
}
function sheetOpen() { return !!sheet && !sheet.hidden; }
function openSheet({ title: label = 'Filtros', nodes = [], opener = null } = {}) {
  if (!isApp()) return false;
  ensureSheet();
  closeSheet(false);
  sheetTitle.textContent = label;
  moved = nodes.filter(Boolean).map(node => {
    const marker = document.createComment('adm-app-sheet');
    node.before(marker);
    sheetBody.append(node);
    return { node, marker };
  });
  sheetOpener = opener;
  sheet.hidden = sheetBackdrop.hidden = false;
  document.body.classList.add('adm-app-sheet-open');
  sheet.querySelector('.adm-app-sheet-done').focus({ preventScroll: true });
  return true;
}
function closeSheet(restoreFocus = true) {
  if (!sheet) return;
  // Si el módulo se volvió a dibujar mientras la hoja estaba abierta, el
  // lugar original ya no existe: el nodo viejo se descarta.
  for (const { node, marker } of moved) { if (marker.isConnected) marker.replaceWith(node); else node.remove(); }
  moved = [];
  sheet.hidden = sheetBackdrop.hidden = true;
  document.body.classList.remove('adm-app-sheet-open');
  const opener = typeof sheetOpener === 'function' ? sheetOpener() : sheetOpener;
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  sheetOpener = null;
}

// ── Botón "Filtros" que abre la hoja con los filtros secundarios ──
// Los campos siguen siendo los reales (mismos eventos y valores); en modo app
// solo se ocultan en la barra y se muestran dentro de la hoja.
// Si el módulo vuelve a dibujar la barra (mismo contenedor, hijos nuevos), se
// vuelve a enganchar con los campos nuevos.
const filterWires = new WeakMap();
function filterSheet(toolbar, fields, currentToolbar = () => toolbar) {
  if (!toolbar || !fields.length) return;
  const wired = filterWires.get(toolbar);
  if (wired && wired.button.parentNode === toolbar && wired.fields.length === fields.length && wired.fields.every((field, i) => field === fields[i])) { wired.sync(); return; }
  wired?.button.remove();
  fields.forEach(field => field.classList.add('adm-app-filter-field'));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'adm-app-filter-btn';
  button.setAttribute('aria-haspopup', 'dialog');
  const sync = () => {
    // Selector con opción distinta de la primera, o campo (p. ej. fecha) con valor.
    const active = fields.filter(field => { const control = field.matches('select, input') ? field : field.querySelector('select'); return control?.matches('select') ? control.selectedIndex > 0 : !!control?.value; }).length;
    const label = active ? `Filtros · ${active}` : 'Filtros';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', active ? `Filtros, ${active} activo${active === 1 ? '' : 's'}` : 'Filtros');
  };
  // El foco vuelve al botón vigente (la barra puede haberse redibujado entera).
  button.addEventListener('click', () => openSheet({ title: 'Filtros', nodes: fields, opener: () => filterWires.get(currentToolbar())?.button }));
  fields.forEach(field => field.addEventListener('change', sync));
  toolbar.append(button);
  filterWires.set(toolbar, { button, fields, sync });
  sync();
}

// Pedidos: Pago, Entrega y Orden pasan a la hoja; la búsqueda queda visible.
// El tablero se monta después (shopify-commerce-admin.js), por eso se observa
// la sección. Solo cambia el texto del botón si cambia (evita bucles).
const ordersSection = document.getElementById('section-pedidos');
if (ordersSection) {
  const wireOrders = () => {
    const toolbar = ordersSection.querySelector('#tt-commerce-orders .tt-order-toolbar');
    if (toolbar) filterSheet(toolbar, [...toolbar.querySelectorAll(':scope > label')].filter(label => !label.querySelector('input[type="search"]')));
  };
  new MutationObserver(wireOrders).observe(ordersSection, { childList: true, subtree: true });
  wireOrders();
}

// Ventas locales: Mes, Casilla y Estado del registro pasan a la hoja. La lista
// se vuelve a dibujar en cada filtro/búsqueda (comercio-local-admin.js).
const ledger = document.getElementById('local-ledger');
if (ledger) {
  const wireLedger = () => {
    const current = () => ledger.querySelector(':scope > .local-toolbar');
    const toolbar = current();
    if (toolbar) filterSheet(toolbar, [...toolbar.querySelectorAll(':scope > label')].filter(label => label.querySelector('select')), current);
  };
  new MutationObserver(wireLedger).observe(ledger, { childList: true, subtree: true });
  wireLedger();
}

// Colecciones: Visibilidad y Orden pasan a la hoja; la búsqueda queda visible.
// shopify-commerce-admin.js vuelve a dibujar la barra en cada filtro.
const collectionsSection = document.getElementById('section-colecciones');
if (collectionsSection) {
  const wireCollections = () => {
    const current = () => collectionsSection.querySelector('#tt-commerce-collections .tt-commerce-toolbar');
    const toolbar = current();
    if (toolbar) filterSheet(toolbar, [...toolbar.querySelectorAll(':scope > select')], current);
  };
  new MutationObserver(wireCollections).observe(collectionsSection, { childList: true, subtree: true });
  wireCollections();
}

// Reseñas y Me gusta: gestion-participacion-admin-v2.js dibuja las barras una
// sola vez (al hidratar la sección). Estado/Puntuación/Respuesta/Periodo/Orden
// pasan a la hoja; la búsqueda queda visible. Solo barras con 2+ selectores.
for (const id of ['section-resenas', 'section-me-gusta']) {
  const section = document.getElementById(id);
  if (!section) continue;
  const wire = () => section.querySelectorAll('.eg-toolbar').forEach(toolbar => {
    const fields = [...toolbar.querySelectorAll(':scope > label')].filter(label => label.querySelector('select'));
    if (fields.length > 1) filterSheet(toolbar, fields);
  });
  new MutationObserver(wire).observe(section, { childList: true });
  wire();
  // La casilla mide 22 px; en modo app el toque en su zona de 44 px la marca
  // (mismo clic real sobre la casilla) y no abre el detalle de la tarjeta.
  section.addEventListener('click', event => {
    if (!isApp()) return;
    const zone = event.target.closest?.('.eg-card-select');
    if (!zone || event.target.matches('input')) return;
    event.stopPropagation();
    zone.querySelector('input[type="checkbox"]')?.click();
  }, true);
}

// Diagnóstico: los 10 selectores y la fecha pasan a la hoja; la búsqueda y
// Copiar/Exportar quedan visibles. La barra es fija en admin.html
// (diagnostico-sitio-admin.js solo la muestra u oculta y llena opciones).
const diagnosticToolbar = document.getElementById('site-diagnostic-toolbar');
if (diagnosticToolbar) filterSheet(diagnosticToolbar, [...diagnosticToolbar.querySelectorAll(':scope > select, :scope > input[type="date"]')]);

// ── Deslizar para recargar ──
// Solo se conecta donde el módulo ya tiene una recarga real (refresh).
function pullToRefresh(scope, refresh) {
  if (!scope || typeof refresh !== 'function') return;
  let indicator = document.querySelector('.adm-app-ptr');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'adm-app-ptr';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
    document.body.append(indicator);
  }
  let startY = null, distance = 0, busy = false;
  const paint = (y, opacity) => { indicator.style.transform = `translateY(${y}px) rotate(${y * 3}deg)`; indicator.style.opacity = String(opacity); };
  scope.addEventListener('touchstart', event => {
    if (!isApp() || busy || window.scrollY > 0 || !scope.closest('.adm-section.active')) { startY = null; return; }
    startY = event.touches[0].clientY; distance = 0;
  }, { passive: true });
  scope.addEventListener('touchmove', event => {
    if (startY == null) return;
    distance = Math.max(0, Math.min(96, event.touches[0].clientY - startY));
    if (distance > 4) paint(distance - 56, Math.min(1, distance / 64));
  }, { passive: true });
  scope.addEventListener('touchend', async () => {
    if (startY == null) return;
    startY = null;
    if (distance < 64) { paint(-56, 0); return; }
    busy = true;
    indicator.classList.add('is-loading');
    paint(12, 1);
    try { await refresh(); } finally {
      busy = false;
      indicator.classList.remove('is-loading');
      paint(-56, 0);
    }
  });
}

window.AdmApp = Object.freeze({ isApp, openSheet, closeSheet, pullToRefresh });
syncMode();
