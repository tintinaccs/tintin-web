/**
 * TINTIN — Nav Collections Sync
 * Real-time sync of the site-wide navigation (desktop "TIENDA" dropdown,
 * mobile category grid, and the mobile bottom sheet) with Super Admin →
 * Colecciones. Same data source as catalogo.html/collections.html/home.
 *
 * Until Super Admin has real collection docs in Firestore, this leaves the
 * existing curated menu markup untouched (fallback behavior).
 */
import { onCollectionsUpdate, FALLBACK_COLLECTIONS } from './collections-store.js';

function slugFromHref(href) {
  const m = (href || '').match(/[?&]cat=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function syncLinkGroup(anchors, cols, updateLabel, buildNode, appendTarget) {
  const bySlug = {};
  cols.forEach(c => { bySlug[c.slug] = c; });

  anchors.forEach(a => {
    const slug = slugFromHref(a.getAttribute('href'));
    if (!slug) return;
    const c = bySlug[slug];
    if (!c) { a.style.display = 'none'; return; }
    a.style.display = '';
    updateLabel(a, c);
    delete bySlug[slug];
  });

  // Brand-new collections created from Super Admin that aren't in the static markup yet
  Object.values(bySlug).forEach(c => {
    const node = buildNode(c);
    if (node && appendTarget) appendTarget.appendChild(node);
  });
}

const GENERIC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';

export function initNavCollections() {
  onCollectionsUpdate(cols => {
    if (cols === FALLBACK_COLLECTIONS) return; // nothing custom configured yet — keep curated menu as-is

    // Desktop dropdown
    const dropdownGrid = document.querySelector('.tt-dropdown-grid');
    if (dropdownGrid) {
      syncLinkGroup(
        dropdownGrid.querySelectorAll('.tt-dropdown-card'),
        cols,
        (a, c) => { const label = a.querySelector('.tt-dropdown-label'); if (label && c.name) label.textContent = c.name.toUpperCase(); },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-dropdown-card';
          a.innerHTML = `<div class="tt-dropdown-icon">${GENERIC_ICON}</div><div class="tt-dropdown-label">${(c.name || c.slug).toUpperCase()}</div>`;
          return a;
        },
        dropdownGrid
      );
    }

    // Mobile category grid
    const mobileGrid = document.querySelector('.tt-mobile-cats-grid');
    if (mobileGrid) {
      syncLinkGroup(
        mobileGrid.querySelectorAll('.tt-mobile-cat-card'),
        cols,
        (a, c) => { const label = a.querySelector('span:last-child'); if (label && c.name) label.textContent = c.name; },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-mobile-cat-card';
          a.innerHTML = `<div class="tt-mobile-cat-img" style="background:linear-gradient(135deg,#e8c5d0,#c48a9e)">${GENERIC_ICON.replace('currentColor', '#fff')}</div><span>${c.name || c.slug}</span>`;
          return a;
        },
        mobileGrid
      );
    }

    // Mobile bottom sheet
    const sheetFooter = document.querySelector('.tt-sheet-footer');
    const sheetItems = document.querySelectorAll('.tt-sheet-item');
    if (sheetItems.length) {
      syncLinkGroup(
        sheetItems,
        cols,
        (a, c) => { const label = a.querySelector('span:last-child'); if (label && c.name) label.textContent = c.name.toUpperCase(); },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-sheet-item';
          a.innerHTML = `<span></span><span>${(c.name || c.slug).toUpperCase()}</span>`;
          return a;
        },
        sheetItems[0] ? sheetItems[0].parentElement : sheetFooter?.parentElement
      );
    }
  });
}

initNavCollections();
