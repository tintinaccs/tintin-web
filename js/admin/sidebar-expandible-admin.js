// Fijado/automático es persistente; hover/foco es una apertura transitoria.
const STORAGE_KEY = 'tintin.admin.sidebar.compact.v1';
const root = document.documentElement;
const toggle = document.getElementById('adm-sidebar-toggle');
const sidebar = document.getElementById('adm-sidebar');
const hamburger = document.getElementById('adm-hamburger');
const overlay = document.getElementById('adm-overlay');
const main = document.querySelector('.adm-main');
const mobileTabs = document.getElementById('adm-mobile-tabs');
const mobileLayout = window.matchMedia('(max-width: 540px)');
const hoverLayout = window.matchMedia('(hover: hover) and (pointer: fine)');
let pinned = false, peek = false, keyboard = false, closeTimer;
try { pinned = localStorage.getItem(STORAGE_KEY) === '0'; } catch {}
sidebar?.querySelectorAll('.adm-nav-item').forEach(item => {
  const label = item.textContent.trim().replace(/\s+/g, ' ');
  item.setAttribute('title', label); item.setAttribute('aria-label', label);
});
function render() {
  const expanded = pinned || peek;
  root.classList.toggle('adm-sidebar-auto', !pinned);
  root.classList.toggle('adm-sidebar-peek', peek && !pinned);
  root.classList.toggle('adm-sidebar-is-collapsed', !expanded);
  const label = mobileLayout.matches ? 'Cerrar menú de módulos' : pinned ? 'Soltar barra lateral: abrir al acercarte' : 'Fijar barra lateral abierta';
  toggle?.setAttribute('aria-label', label); toggle?.setAttribute('title', label);
  toggle?.setAttribute('aria-pressed', String(pinned && !mobileLayout.matches));
  toggle?.setAttribute('aria-expanded', String(mobileLayout.matches ? sidebar?.classList.contains('open') : expanded));
}
function setMobileOpen(open, { restoreFocus = false } = {}) {
  const isOpen = Boolean(open && mobileLayout.matches);
  sidebar?.classList.toggle('open', isOpen); overlay?.classList.toggle('show', isOpen);
  root.classList.toggle('adm-mobile-sidebar-open', isOpen);
  if (sidebar) sidebar.inert = mobileLayout.matches && !isOpen;
  if (main) main.inert = isOpen;
  if (mobileTabs) mobileTabs.inert = isOpen;
  hamburger?.setAttribute('aria-expanded', String(isOpen));
  hamburger?.setAttribute('aria-label', isOpen ? 'Cerrar menú de módulos' : 'Abrir menú de módulos');
  render();
  if (isOpen) toggle?.focus({ preventScroll: true });
  else if (restoreFocus) hamburger?.focus({ preventScroll: true });
}
function openPeek() {
  window.clearTimeout(closeTimer);
  if (mobileLayout.matches || pinned) return;
  peek = true; render();
}
function closePeek() {
  window.clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => {
    if (keyboard && sidebar?.contains(document.activeElement)) return;
    peek = false; render();
  }, 80);
}
toggle?.addEventListener('click', () => {
  if (mobileLayout.matches) { setMobileOpen(false, { restoreFocus: true }); return; }
  pinned = !pinned; peek = !pinned && hoverLayout.matches && sidebar.matches(':hover');
  try { localStorage.setItem(STORAGE_KEY, pinned ? '0' : '1'); } catch {}
  render();
});
sidebar?.addEventListener('pointerenter', () => { if (hoverLayout.matches) openPeek(); });
sidebar?.addEventListener('pointerleave', closePeek);
sidebar?.addEventListener('focusin', () => { if (keyboard) openPeek(); });
sidebar?.addEventListener('focusout', closePeek);
document.addEventListener('pointerdown', () => { keyboard = false; });
hamburger?.addEventListener('click', () => setMobileOpen(!sidebar?.classList.contains('open')));
overlay?.addEventListener('click', () => setMobileOpen(false, { restoreFocus: true }));
sidebar?.addEventListener('click', event => {
  if (mobileLayout.matches && event.target.closest('.adm-nav-item, .adm-nav-bottom a, .adm-nav-bottom button')) setMobileOpen(false, { restoreFocus: true });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') {
    keyboard = true;
    if (mobileLayout.matches && sidebar?.classList.contains('open')) {
      const controls = [...sidebar.querySelectorAll('button,a[href]')].filter(item => !item.disabled && item.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  if (event.key === 'Escape') {
    if (mobileLayout.matches) setMobileOpen(false, { restoreFocus: true });
    else { keyboard = false; peek = false; render(); }
  }
});
mobileLayout.addEventListener('change', () => { peek = false; setMobileOpen(false); });
setMobileOpen(false);
