import { UI_ICONS, svgIcon } from './icons.js';

export function renderSearchPanel() {
  return `
    <div class="tt-search-panel" id="search-panel" role="dialog" aria-modal="true" aria-label="Buscar productos" aria-hidden="true">
      ${svgIcon(UI_ICONS.search, { stroke: '#888' })}
      <input type="search" class="tt-search-input" id="search-input" aria-label="Buscar productos" autocomplete="off" placeholder="¿Qué estás buscando? Ej: reloj, collar, bolso…">
      <button type="button" class="tt-search-close" id="btn-search-close" aria-label="Cerrar búsqueda">✕</button>
      <div class="tt-search-results" id="search-results" role="listbox" aria-label="Resultados de búsqueda" style="display:none"></div>
    </div>`;
}
