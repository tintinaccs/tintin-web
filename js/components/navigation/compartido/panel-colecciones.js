import { logoUrl } from './configuracion.js?v=tintin-20261010-whatsapp-release-5';
import { CATEGORIES, UI_ICONS, collectionImageUrl, svgIcon } from './iconos.js?v=tintin-20260916-final-production-stability-iconos-1-master-20261007-1';

function renderSheetCategories() {
  return CATEGORIES.map(({ slug, label }) => `
    <a href="/catalogo?cat=${slug}" class="tt-sheet-item">
      <span class="tt-sheet-item-img" aria-hidden="true"><img data-tt-collection-image data-src="${collectionImageUrl(slug)}" alt="" loading="lazy"></span>
      <span>${label.toUpperCase()}</span>
    </a>`).join('');
}

export function renderCollectionsSheet() {
  return `
    <div class="tt-collections-sheet" id="collections-sheet" role="dialog" aria-modal="true" aria-label="Catálogo" aria-hidden="true">
      <div class="tt-sheet-handle" aria-hidden="true"></div>
      <div class="tt-sheet-header">
        <div class="tt-drawer-brand-heading"><img class="tt-drawer-brand-logo" src="${logoUrl()}" alt="Tintin" width="110" height="46"><h2>CATÁLOGO</h2></div>
        <button type="button" id="btn-close-sheet" aria-label="Cerrar colecciones">${svgIcon(UI_ICONS.close, { size: 16 })}</button>
      </div>
      <div class="tt-sheet-grid" data-collections-nav="sheet">${renderSheetCategories()}</div>
      <div class="tt-sheet-footer">
        <nav class="tt-sheet-info-links" aria-label="Información de Tintin"><a href="/about">Nosotros</a><a href="/contact">Contacto</a></nav>
        <a href="/catalogo" class="tt-btn" style="display:block;text-align:center;text-decoration:none">Ver todas las colecciones</a>
      </div>
    </div>`;
}
