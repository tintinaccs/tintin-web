// Presentación compartida. No consulta datos ni sustituye navegación o CRUD.
import { MAESTRO_MODULES } from './registro-maestro.js?v=tintin-20261009-local-ledger-master-1';

const modules = new Map(MAESTRO_MODULES.map(module => [module.id, module]));
const roots = new Map();
const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
const text = element => element.textContent.replace(/\s+/g, ' ').trim();
let sequence = 0;

function create(tag, className, content) {
  const node = document.createElement(tag);
  node.className = className;
  if (content) node.textContent = content;
  return node;
}

function mount(root, id) {
  const module = modules.get(id);
  if (!module || roots.get(root)?.bar.isConnected) return;
  root.classList.add('tt-admin-workspace');
  const bar = create('div', 'tt-admin-workspace-bar');
  const title = create('h2', 'tt-admin-workspace-title', module.label);
  const label = create('label', 'tt-admin-workspace-jump', 'Ir a una sección');
  label.hidden = true;
  const select = create('select', 'adm-select');
  select.id = `tt-admin-jump-${id}`;
  label.htmlFor = select.id;
  label.append(select);
  const search = create('button', 'adm-btn adm-btn-outline', 'Buscar registros');
  search.type = 'button';
  search.hidden = true;
  bar.append(title, label, search);
  root.prepend(bar);
  const state = { bar, title, select, label, search, targets: [], searchTarget: null, signature: '' };
  roots.set(root, state);
  select.addEventListener('change', () => {
    const target = state.targets[Number(select.value)];
    if (!target || !visible(target)) return;
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  search.addEventListener('click', () => {
    const target = state.searchTarget;
    if (!target || !visible(target)) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
}

function enhanceFields(root) {
  // Sólo grillas de formularios declaradas en línea. Los editores especializados
  // (Productos, lienzo visual) conservan su propia distribución y navegación.
  for (const grid of root.querySelectorAll('[style*="grid-template-columns"]')) {
    if (grid.closest('#section-productos,.apar-main-grid,#prod-form-card')) continue;
    if (!grid.classList.contains('tt-admin-field-grid') && grid.querySelector('input:not([type="checkbox"]):not([type="hidden"]),select,textarea')) grid.classList.add('tt-admin-field-grid');
  }
  for (const field of root.querySelectorAll('.adm-field,.tt-welcome-admin-field,.adm-hero-ctrl-row')) {
    const labels = field.querySelectorAll(':scope > label');
    const controls = field.querySelectorAll('input:not([type="hidden"]),select,textarea');
    if (labels.length !== 1 || controls.length !== 1 || labels[0].htmlFor || labels[0].contains(controls[0])) continue;
    if (!controls[0].id) controls[0].id = `tt-admin-field-${++sequence}`;
    labels[0].htmlFor = controls[0].id;
  }
}

function refresh(root, state) {
  if (!visible(root)) return;
  state.title.hidden = Boolean(root.querySelector('.tt-commerce-pagehead,.adm-statistics-hero'));
  enhanceFields(root);
  const candidates = [...root.querySelectorAll('.adm-card-title,.adm-section-head h2,.adm-card > h2,.adm-card-label,.tt-welcome-admin-title,.tt-maestro-panel h2')];
  const targets = candidates.filter(target => !target.closest('[role="dialog"],dialog') && visible(target) && text(target));
  const signature = targets.map(target => text(target)).join('\n');
  state.targets = targets;
  if (signature !== state.signature) {
    state.signature = signature;
    const placeholder = new Option('Elegí una sección…', '');
    placeholder.disabled = true;
    state.select.replaceChildren(placeholder, ...targets.map((target, index) => new Option(text(target), String(index))));
    state.select.value = '';
  }
  state.label.hidden = targets.length < 2;
  state.searchTarget = [...root.querySelectorAll('input[type="search"],input[id*="search"],input[data-filter$="-search"]')].find(target => visible(target) && !target.disabled && !target.closest('dialog,[role="dialog"]'));
  state.search.hidden = !state.searchTarget;
  state.bar.hidden = state.title.hidden && state.label.hidden && state.search.hidden;

  for (const table of root.querySelectorAll('.adm-table-wrap')) {
    const overflow = visible(table) && table.scrollWidth > table.clientWidth + 1;
    if (!table.hasAttribute('tabindex')) table.tabIndex = 0;
    if (!table.hasAttribute('role')) table.setAttribute('role', 'region');
    if (!table.hasAttribute('aria-label') && !table.hasAttribute('aria-labelledby')) {
      table.setAttribute('aria-label', `Tabla de ${modules.get(root.id.replace('section-', ''))?.label || 'registros'}`);
    }
    let hint = table.previousElementSibling;
    if (!hint?.classList.contains('tt-admin-table-hint')) {
      hint = create('p', 'tt-admin-table-hint', 'Deslizá la tabla para ver todas las columnas. Con teclado, usá las flechas.');
      hint.id = `tt-admin-table-hint-${++sequence}`;
      table.before(hint);
      const descriptions = table.getAttribute('aria-describedby') || '';
      table.setAttribute('aria-describedby', `${descriptions} ${hint.id}`.trim());
    }
    hint.hidden = !overflow;
  }
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    for (const root of document.querySelectorAll('.adm-content > .adm-section,[data-admin-workspace]')) {
      mount(root, root.dataset.adminWorkspace || root.id.replace('section-', ''));
    }
    for (const [root, state] of roots) {
      if (!root.isConnected) roots.delete(root);
      else refresh(root, state);
    }
  });
}

// Observar contenido y visibilidad, también en módulos montados después del auth.
// No se observa class/aria: las mejoras no realimentan el observer ni interceptan eventos.
const observer = new MutationObserver(records => {
  if (records.some(record => !record.target.closest?.('.tt-admin-workspace-bar,.tt-admin-table-hint'))) schedule();
});
for (const surface of document.querySelectorAll('.adm-content,[data-admin-workspace]')) {
  observer.observe(surface, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
}
// La activación nativa cambia class; se observa sólo el contenedor de secciones.
const sections = new MutationObserver(schedule);
for (const root of document.querySelectorAll('.adm-content')) sections.observe(root, { attributes: true, subtree: true, attributeFilter: ['class'] });
window.addEventListener('resize', schedule, { passive: true });
schedule();
