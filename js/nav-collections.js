/**
 * TINTIN — Nav Collections Sync
 * Real-time sync of the site-wide navigation (desktop "TIENDA" dropdown,
 * mobile category grid, and the mobile bottom sheet) with Super Admin →
 * Colecciones. Same data source as catalogo.html/collections.html/home.
 *
 * Until Super Admin has real collection docs in Firestore, this leaves the
 * existing curated menu markup untouched (fallback behavior) — except for
 * the mobile bottom sheet's images, which always show a real per-collection
 * photo (same static covers used on the home grid) since that sheet had no
 * curated icon look to begin with.
 */
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

// Same static-cover convention as the home "Nuestras Colecciones" grid.
const COLL_IMG_BASE = 'assets-tintin/images/collections/';
const COLL_PLACEHOLDER = COLL_IMG_BASE + 'col-placeholder.webp';
const SLUG_FILE_MAP = { bolsos: 'bags' }; // only irregular slug->filename case; rest match 1:1
function collImgFile(slug) { return SLUG_FILE_MAP[slug] || slug; }

// Always-on image for the mobile sheet: custom Firestore image wins, else the
// static cover matching the slug, else the generic placeholder. Mirrors
// index.html's setCollCardImage() so mobile stays visually linked to whatever
// desktop/tablet/home end up showing for the same collection.
function setSheetImage(wrap, slug, customUrl, altName) {
  let img = wrap.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    wrap.appendChild(img);
  }
  img.alt = altName || slug;
  const bySlugFallback = `${COLL_IMG_BASE}col-${collImgFile(slug)}.webp`;
  img.onerror = () => {
    if (img.src.indexOf(COLL_PLACEHOLDER) === -1) {
      img.onerror = null;
      img.src = COLL_PLACEHOLDER;
    }
  };
  img.src = customUrl || bySlugFallback;
}

// Optional override for the desktop dropdown / tablet category grid: these
// keep their curated icon/gradient look by default (not redesigned), only
// swapping to a real photo once Super Admin sets one for that collection —
// and reverting cleanly if it's later cleared or fails to load.
function applyCustomIconImage(wrap, url, altName, fit) {
  if (!wrap) return;
  if (wrap.dataset.origIcon === undefined) wrap.dataset.origIcon = wrap.innerHTML;
  if (!url) { wrap.innerHTML = wrap.dataset.origIcon; return; }
  let img = wrap.querySelector('img.tt-coll-nav-img');
  if (!img) {
    wrap.innerHTML = '';
    img = document.createElement('img');
    img.className = 'tt-coll-nav-img';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = `width:100%;height:100%;object-fit:${fit || 'contain'};display:block;`;
    wrap.appendChild(img);
  }
  img.alt = altName || '';
  img.onerror = () => { wrap.innerHTML = wrap.dataset.origIcon; };
  img.src = url;
}

// Runs immediately (independent of Firestore state) so the mobile dropup
// always shows real collection photos, well-fit, never left as bare text.
function applySheetDefaultImages() {
  document.querySelectorAll('.tt-sheet-item').forEach(a => {
    const slug = slugFromHref(a.getAttribute('href'));
    if (!slug) return;
    const spans = a.querySelectorAll('span');
    const wrap = spans[0];
    if (!wrap) return;
    wrap.classList.add('tt-sheet-item-img');
    setSheetImage(wrap, slug, null, spans[1] ? spans[1].textContent : slug);
  });
}

// Always applied immediately, independent of Firestore/network — the sheet's
// real photos must never depend on collections-store.js (which statically
// imports the Firebase SDK) having successfully loaded.
applySheetDefaultImages();

export function initNavCollections() {
  // Dynamic import: a Firebase/network hiccup here must not prevent the
  // static default images above from having already applied.
  import('./collections-store.js').then(({ onCollectionsUpdate, FALLBACK_COLLECTIONS }) => {
    onCollectionsUpdate(cols => {
    if (cols === FALLBACK_COLLECTIONS) return; // nothing custom configured yet — keep curated menu as-is

    // Desktop dropdown
    const dropdownGrid = document.querySelector('.tt-dropdown-grid');
    if (dropdownGrid) {
      syncLinkGroup(
        dropdownGrid.querySelectorAll('.tt-dropdown-card'),
        cols,
        (a, c) => {
          const label = a.querySelector('.tt-dropdown-label'); if (label && c.name) label.textContent = c.name.toUpperCase();
          const icon = a.querySelector('.tt-dropdown-icon'); if (icon) applyCustomIconImage(icon, c.image, c.name);
        },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-dropdown-card';
          const iconHtml = c.image ? `<img src="${c.image}" alt="${c.name || c.slug}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;display:block;">` : GENERIC_ICON;
          a.innerHTML = `<div class="tt-dropdown-icon">${iconHtml}</div><div class="tt-dropdown-label">${(c.name || c.slug).toUpperCase()}</div>`;
          return a;
        },
        dropdownGrid
      );
    }

    // Mobile category grid (tablet hamburger menu)
    const mobileGrid = document.querySelector('.tt-mobile-cats-grid');
    if (mobileGrid) {
      syncLinkGroup(
        mobileGrid.querySelectorAll('.tt-mobile-cat-card'),
        cols,
        (a, c) => {
          const label = a.querySelector('span:last-child'); if (label && c.name) label.textContent = c.name;
          const img = a.querySelector('.tt-mobile-cat-img'); if (img) applyCustomIconImage(img, c.image, c.name, 'cover');
        },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-mobile-cat-card';
          const inner = c.image ? `<img src="${c.image}" alt="${c.name || c.slug}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;">` : GENERIC_ICON.replace('currentColor', '#fff');
          a.innerHTML = `<div class="tt-mobile-cat-img" style="background:linear-gradient(135deg,#e8c5d0,#c48a9e)">${inner}</div><span>${c.name || c.slug}</span>`;
          return a;
        },
        mobileGrid
      );
    }

    // Mobile bottom sheet — always-on real images, custom Firestore image wins over static cover
    const sheetFooter = document.querySelector('.tt-sheet-footer');
    const sheetItems = document.querySelectorAll('.tt-sheet-item');
    if (sheetItems.length) {
      syncLinkGroup(
        sheetItems,
        cols,
        (a, c) => {
          const label = a.querySelector('span:last-child'); if (label && c.name) label.textContent = c.name.toUpperCase();
          const wrap = a.querySelector('span:first-child');
          if (wrap) { wrap.classList.add('tt-sheet-item-img'); setSheetImage(wrap, c.slug, c.image, c.name); }
        },
        (c) => {
          const a = document.createElement('a');
          a.href = `catalogo.html?cat=${c.slug}`;
          a.className = 'tt-sheet-item';
          a.innerHTML = `<span class="tt-sheet-item-img"></span><span>${(c.name || c.slug).toUpperCase()}</span>`;
          setSheetImage(a.querySelector('.tt-sheet-item-img'), c.slug, c.image, c.name);
          return a;
        },
        sheetItems[0] ? sheetItems[0].parentElement : sheetFooter?.parentElement
      );
    }
    });
  }).catch(e => {
    console.warn('[nav-collections] Firestore sync unavailable, keeping static defaults:', e);
  });
}

initNavCollections();
