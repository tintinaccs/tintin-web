// Barra lateral del Super Panel: compacta persistente, expansión temporal al
// pasar el cursor y sin recalcular el ancho del contenido principal.
const STORAGE_KEY = 'tintin.admin.sidebar.compact.v1';
const root = document.documentElement;
const toggle = document.getElementById('adm-sidebar-toggle');

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
toggle?.addEventListener('click', () => setCompact(!root.classList.contains('adm-sidebar-is-collapsed')));
