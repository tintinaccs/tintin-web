// Barra lateral del Super Panel: control explícito en escritorio y tablet;
// en móvil se abre como un menú sobre el contenido.
const STORAGE_KEY = 'tintin.admin.sidebar.compact.v1';
const root = document.documentElement;
const toggle = document.getElementById('adm-sidebar-toggle');
const sidebar = document.getElementById('adm-sidebar');
const hamburger = document.getElementById('adm-hamburger');
const overlay = document.getElementById('adm-overlay');
const main = document.querySelector('.adm-main');
const mobileTabs = document.getElementById('adm-mobile-tabs');
const mobileLayout = window.matchMedia('(max-width: 540px)');

function setMobileOpen(open, { restoreFocus = false } = {}) {
  const isOpen = open && mobileLayout.matches;
  sidebar?.classList.toggle('open', isOpen);
  overlay?.classList.toggle('show', isOpen);
  root.classList.toggle('adm-mobile-sidebar-open', isOpen);
  if (sidebar) sidebar.inert = mobileLayout.matches && !isOpen;
  if (main) main.inert = isOpen;
  if (mobileTabs) mobileTabs.inert = isOpen;
  hamburger?.setAttribute('aria-expanded', String(isOpen));
  hamburger?.setAttribute('aria-label', isOpen ? 'Cerrar menú de módulos' : 'Abrir menú de módulos');
  const compact = root.classList.contains('adm-sidebar-is-collapsed');
  const toggleLabel = mobileLayout.matches ? 'Cerrar menú de módulos' : compact ? 'Expandir barra lateral' : 'Contraer barra lateral';
  toggle?.setAttribute('aria-label', toggleLabel);
  toggle?.setAttribute('title', toggleLabel);
  toggle?.setAttribute('aria-pressed', String(!mobileLayout.matches && compact));
  if (isOpen) toggle?.focus({ preventScroll: true });
  else if (restoreFocus) hamburger?.focus({ preventScroll: true });
}

function setCompact(compact, { persist = true } = {}) {
  root.classList.toggle('adm-sidebar-is-collapsed', compact);
  toggle?.setAttribute('aria-pressed', String(compact));
  const label = compact ? 'Expandir barra lateral' : 'Contraer barra lateral';
  toggle?.setAttribute('aria-label', label);
  toggle?.setAttribute('title', label);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, compact ? '1' : '0'); } catch {}
  }
}

const tabletLayout = window.matchMedia?.('(min-width: 541px) and (max-width: 900px)').matches === true;
try {
  const savedPreference = localStorage.getItem(STORAGE_KEY);
  setCompact(savedPreference === null ? tabletLayout : savedPreference === '1', { persist: false });
} catch {
  setCompact(tabletLayout, { persist: false });
}
setMobileOpen(false);
toggle?.addEventListener('click', () => {
  if (mobileLayout.matches) setMobileOpen(false, { restoreFocus: true });
  else setCompact(!root.classList.contains('adm-sidebar-is-collapsed'));
});
hamburger?.addEventListener('click', () => setMobileOpen(!sidebar?.classList.contains('open')));
overlay?.addEventListener('click', () => setMobileOpen(false, { restoreFocus: true }));
sidebar?.addEventListener('click', event => {
  if (mobileLayout.matches && event.target.closest('.adm-nav-item, .adm-nav-bottom a, .adm-nav-bottom button')) {
    setMobileOpen(false, { restoreFocus: true });
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
    setMobileOpen(false, { restoreFocus: true });
  }
});
mobileLayout.addEventListener('change', () => setMobileOpen(false));
