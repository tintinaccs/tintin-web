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
  if (persist) localStorage.setItem(STORAGE_KEY, compact ? '1' : '0');
}

try { setCompact(localStorage.getItem(STORAGE_KEY) === '1', { persist: false }); } catch { setCompact(false, { persist: false }); }
toggle?.addEventListener('click', () => setCompact(!root.classList.contains('adm-sidebar-is-collapsed')));
