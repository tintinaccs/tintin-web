import { MAESTRO_MODULES } from './registro-maestro.js?v=tintin-20261009-local-ledger-master-1';

// Navega mediante los controles originales: conserva autorización y borradores.
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
let dialog, input, results, status, opener;
let matches = [];
let navigating = false;
let availability = '';

function nativeControl(id) {
  if (!document.documentElement.classList.contains('adm-auth-ready')) return null;
  const node = id === 'imagenes'
    ? document.querySelector('#adm-nav a[href="/admin-images"]')
    : document.querySelector(`#adm-nav [data-section="${CSS.escape(id)}"]`);
  // En móvil la barra lateral cerrada hereda visibility:hidden. Eso no
  // equivale a una restricción de módulo: el guard nativo valida al navegar.
  if (!node || node.disabled || node.hidden || node.closest('[hidden]') || getComputedStyle(node).display === 'none' || node.style.visibility === 'hidden') return null;
  return node;
}

function available() {
  return MAESTRO_MODULES.filter(module => nativeControl(module.id));
}

function node(tag, className, value) {
  const element = document.createElement(tag); element.className = className;
  if (value) element.textContent = value;
  return element;
}

function arrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({ width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', 'M7 17 17 7M7 7h10v10'); svg.append(path);
  return svg;
}

function mountDashboard() {
  const dashboard = document.getElementById('section-dashboard');
  if (!dashboard || dashboard.querySelector('.tt-dashboard-hero')) return;
  // El shell administrativo conserva su presupuesto de carga inicial; esta
  // presentación diferida no agrega métricas ni lecturas de datos.
  const hero = node('section', 'tt-dashboard-hero'); hero.setAttribute('aria-labelledby', 'tt-dashboard-heading');
  const intro = node('div', 'tt-dashboard-intro');
  const heading = node('h2', ''); heading.id = 'tt-dashboard-heading';
  heading.append('Tu tienda,', document.createElement('br'), node('span', '', 'en foco.'));
  const explore = node('button', 'adm-btn adm-btn-outline', 'Explorar módulos'); explore.type = 'button'; explore.dataset.adminLauncher = ''; explore.append(arrow());
  intro.append(node('p', 'tt-control-eyebrow', 'TINTIN · PANEL DE CONTROL'), heading,
    node('p', 'tt-dashboard-description', 'Personas, pedidos y catálogo. Una vista clara para organizar tu día.'), explore);
  const shortcuts = node('div', 'tt-dashboard-shortcuts'); shortcuts.setAttribute('aria-label', 'Accesos rápidos');
  const items = [
    ['pedidos', '01 / OPERACIÓN', 'Gestionar pedidos'],
    ['productos', '02 / CATÁLOGO', 'Precios y existencias'],
    ['usuarios', '03 / PERSONAS', 'Administrar cuentas'],
    ['configuracion', '04 / TU TIENDA', 'Preferencias y envíos'],
  ];
  for (const [id, category, description] of items) {
    const button = node('button', 'tt-dashboard-link'); button.type = 'button'; button.hidden = true; button.dataset.adminOpen = id;
    const detail = node('span', '', description); detail.append(arrow());
    button.append(node('span', 'tt-control-eyebrow', category), node('strong', '', MAESTRO_MODULES.find(module => module.id === id).label), detail);
    shortcuts.append(button);
  }
  hero.append(intro, shortcuts); dashboard.prepend(hero);
}

function close() { dialog?.close(); }

function navigate(id) {
  const target = nativeControl(id);
  if (!target) {
    render();
    if (status) status.textContent = 'Este módulo ya no está disponible para tu sesión.';
    return;
  }
  navigating = Boolean(dialog?.open);
  close();
  // El guard existente decide si salir o conservar el borrador actual.
  target.click();
}

function render() {
  if (!results) return;
  const term = normalize(input.value);
  const modules = available();
  availability = modules.map(module => module.id).join('|');
  matches = modules.filter(module => normalize(module.label).includes(term));
  results.replaceChildren();
  for (const module of matches) {
    const item = node('li', 'tt-control-result');
    const button = node('button', 'tt-control-result-button'); button.type = 'button';
    const icon = nativeControl(module.id)?.querySelector('.adm-nav-icon');
    if (icon) { const copy = icon.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); button.append(copy); }
    const arrow = node('span', 'tt-control-result-arrow', '›'); arrow.setAttribute('aria-hidden', 'true');
    button.append(node('span', '', module.label), arrow);
    button.addEventListener('click', () => navigate(module.id));
    item.append(button); results.append(item);
  }
  status.textContent = matches.length ? `${matches.length} módulos disponibles` : 'No encontramos módulos. Probá con otro nombre.';
}

function ensureDialog() {
  if (dialog) return;
  dialog = node('dialog', 'tt-control-dialog'); dialog.id = 'tt-control-module-dialog';
  dialog.setAttribute('aria-labelledby', 'tt-control-module-heading');
  const head = node('div', 'tt-control-dialog-head');
  const title = node('h2', '', 'Buscar módulos'); title.id = 'tt-control-module-heading';
  const dismiss = node('button', 'tt-control-dismiss', '×'); dismiss.type = 'button'; dismiss.setAttribute('aria-label', 'Cerrar buscador'); dismiss.onclick = close;
  head.append(title, dismiss);
  const label = node('label', 'tt-control-search-label', 'Nombre del módulo'); label.htmlFor = 'tt-control-module-search';
  input = node('input', 'adm-input'); input.id = label.htmlFor; input.type = 'search'; input.autocomplete = 'off'; input.placeholder = 'Pedidos, productos, correos…';
  results = node('ul', 'tt-control-results'); results.setAttribute('aria-label', 'Módulos disponibles');
  status = node('p', 'tt-control-dialog-status'); status.setAttribute('role', 'status');
  dialog.append(head, label, input, status, results);
  input.addEventListener('input', render);
  dialog.addEventListener('close', () => {
    if (navigating) { navigating = false; return; }
    if (opener?.isConnected && visible(opener) && !opener.closest('[inert]')) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    const buttons = [...results.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && buttons.length) { event.preventDefault(); buttons[(index + 1) % buttons.length].focus(); }
    if (event.key === 'ArrowUp' && buttons.length) { event.preventDefault(); buttons[index <= 0 ? buttons.length - 1 : index - 1].focus(); }
    if (event.key === 'Enter' && document.activeElement === input && matches.length) { event.preventDefault(); navigate(matches[0].id); }
  });
  document.body.append(dialog);
}

function open() {
  if (!document.documentElement.classList.contains('adm-auth-ready') || document.querySelector('.adm-main')?.inert) return;
  if ([...document.querySelectorAll('dialog[open],[aria-modal="true"]')].some(element => element !== dialog && visible(element))) return;
  ensureDialog();
  if (dialog.open) { input.focus(); return; }
  opener = document.activeElement; input.value = ''; render(); dialog.showModal(); input.focus();
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-admin-launcher]')) {
    // El cajón móvil bloquea el fondo. Cerrarlo con su control nativo antes
    // de abrir el buscador libera inert y conserva la devolución de foco.
    if (event.target.closest('#adm-sidebar.open')) document.getElementById('adm-sidebar-toggle')?.click();
    open();
  }
  const shortcut = event.target.closest('[data-admin-open]');
  if (shortcut && !shortcut.hidden) navigate(shortcut.dataset.adminOpen);
});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
});

function syncShortcuts() {
  for (const shortcut of document.querySelectorAll('[data-admin-open]')) {
    const hidden = !nativeControl(shortcut.dataset.adminOpen);
    if (shortcut.hidden !== hidden) shortcut.hidden = hidden;
  }
  const group = document.querySelector('.tt-dashboard-shortcuts');
  if (group) group.hidden = ![...group.querySelectorAll('[data-admin-open]')].some(button => !button.hidden);
  if (dialog?.open && available().map(module => module.id).join('|') !== availability) render();
}
let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true; requestAnimationFrame(() => { queued = false; syncShortcuts(); });
});
const navigation = document.getElementById('adm-nav');
if (navigation) observer.observe(navigation, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'disabled', 'class'] });
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
mountDashboard();
syncShortcuts();
