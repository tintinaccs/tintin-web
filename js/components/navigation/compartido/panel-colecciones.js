import { CATEGORIES, UI_ICONS, svgIcon } from './iconos.js';

function renderSheetCategories() {
  return CATEGORIES.map(({ slug, label }) => `
    <a href="/catalogo?cat=${slug}" class="tt-sheet-item">
      <span class="tt-sheet-item-image" aria-hidden="true"></span>
      <span>${label.toUpperCase()}</span>
    </a>`).join('');
}

export function renderCollectionsSheet() {
  return `
    <div class="tt-collections-sheet" id="collections-sheet" role="dialog" aria-modal="true" aria-label="Colecciones" aria-hidden="true">
      <div class="tt-sheet-handle" aria-hidden="true"></div>
      <div class="tt-sheet-header">
        <span>Colecciones</span>
        <button type="button" id="btn-close-sheet" aria-label="Cerrar colecciones">${svgIcon(UI_ICONS.close, { size: 16 })}</button>
      </div>
      <div class="tt-sheet-grid" data-collections-nav="sheet">${renderSheetCategories()}</div>
      <div class="tt-sheet-footer">
        <a href="/catalogo" class="tt-btn" style="display:block;text-align:center;text-decoration:none">Ver todas las colecciones</a>
      </div>
    </div>`;
}
