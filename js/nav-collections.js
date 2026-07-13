/**
 * TINTIN — Nav Collections Sync
 * Real-time, full-render sync of every site-wide navigation surface that
 * lists collections (desktop "TIENDA" dropdown, mobile category grid, and
 * the mobile bottom sheet) with Super Admin → Colecciones. Firestore is the
 * only source of truth: every onCollectionsUpdate snapshot clears each
 * dynamic container and rebuilds it from scratch, in Firestore order — a
 * renamed/reordered/hidden/deleted collection is never left as a stale,
 * merely-hidden DOM node from a previous render.
 *
 * Targets are found via data-collections-nav="desktop|mobile|sheet"
 * containers instead of page-specific classes, so this works identically
 * regardless of which page's markup happens to wrap it (this is what fixed
 * catalogo.html's mobile category links never syncing — its container used
 * a different class than index.html's).
 */
function slugFromHref(href) {
  const m = (href || '').match(/[?&]cat=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const GENERIC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
const MOBILE_GRADIENT = 'linear-gradient(135deg,#e8c5d0,#c48a9e)';

// Same static-cover convention as the home "Nuestras Colecciones" grid.
const COLL_IMG_BASE = 'assets-tintin/images/collections/';
const COLL_PLACEHOLDER = COLL_IMG_BASE + 'col-placeholder.webp';
const SLUG_FILE_MAP = { bolsos: 'bags' }; // only irregular slug->filename case; rest match 1:1
function collImgFile(slug) { return SLUG_FILE_MAP[slug] || slug; }

// Always-on image for the mobile sheet: custom Firestore image wins, else the
// static cover matching the slug, else the generic placeholder. Mirrors
// index.html's setCollCardImage() so mobile stays visually linked to whatever
// desktop/tablet/home end up showing for the same collection.
function sheetImg(c) {
  const bySlugFallback = `${COLL_IMG_BASE}col-${collImgFile(c.slug)}.webp`;
  const src = c.image || bySlugFallback;
  return `<img src="${src}" alt="${c.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${COLL_PLACEHOLDER}';">`;
}

function buildDesktopCard(c) {
  const a = document.createElement('a');
  a.href = `catalogo.html?cat=${c.slug}`;
  a.className = 'tt-dropdown-card';
  const iconHtml = c.image
    ? `<img src="${c.image}" alt="${c.name}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;display:block;">`
    : GENERIC_ICON;
  a.innerHTML = `<div class="tt-dropdown-icon">${iconHtml}</div><div class="tt-dropdown-label">${c.name.toUpperCase()}</div>`;
  return a;
}

// Detects which of the two pre-existing mobile-menu visual styles this
// page uses (rich icon cards on index.html vs plain text links on every
// other page) purely from the container's own class — never redesigns
// either style, just rebuilds it correctly on every snapshot.
function buildMobileNode(container, c) {
  const rich = container.classList.contains('tt-mobile-cats-grid');
  const a = document.createElement('a');
  a.href = `catalogo.html?cat=${c.slug}`;
  if (rich) {
    a.className = 'tt-mobile-cat-card';
    const inner = c.image
      ? `<img src="${c.image}" alt="${c.name}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : GENERIC_ICON.replace('currentColor', '#fff');
    a.innerHTML = `<div class="tt-mobile-cat-img" style="background:${MOBILE_GRADIENT}">${inner}</div><span>${c.name}</span>`;
  } else {
    a.textContent = c.name.toUpperCase();
  }
  return a;
}

function buildSheetItem(c) {
  const a = document.createElement('a');
  a.href = `catalogo.html?cat=${c.slug}`;
  a.className = 'tt-sheet-item';
  a.innerHTML = `<span class="tt-sheet-item-img">${sheetImg(c)}</span><span>${c.name.toUpperCase()}</span>`;
  return a;
}

/** Exact full render: container ends up with precisely one node per
 *  collection, in Firestore order — no leftover/hidden nodes, no
 *  duplicates, ever. An explicit empty-state message replaces the
 *  container's content when there are truly zero public collections,
 *  instead of a silently blank dropdown/sheet. */
function renderInto(container, cols, buildNode) {
  if (!container) return;
  container.innerHTML = '';
  if (!cols.length) {
    const empty = document.createElement('div');
    empty.className = 'tt-collections-nav-empty';
    empty.style.cssText = 'padding:12px 16px;font-size:12px;color:var(--text-muted,#888);text-align:center;width:100%;';
    empty.textContent = 'No hay colecciones disponibles';
    container.appendChild(empty);
    return;
  }
  cols.forEach(c => container.appendChild(buildNode(c)));
}

// Seeds real per-slug photos onto whatever .tt-sheet-item anchors are
// already in the static markup (using the slug from each href) — runs
// immediately, with zero dependency on Firestore/collections-store.js
// (which statically imports the Firebase SDK). This is what keeps the
// sheet from ever looking like bare text if Firebase is slow/unreachable;
// the full Firestore-driven render below replaces this the moment real
// data is available.
function seedStaticSheetImages() {
  document.querySelectorAll('[data-collections-nav="sheet"] > .tt-sheet-item').forEach(a => {
    const slug = slugFromHref(a.getAttribute('href'));
    if (!slug) return;
    const spans = a.querySelectorAll('span');
    const wrap = spans[0];
    if (!wrap) return;
    wrap.classList.add('tt-sheet-item-img');
    const name = spans[1] ? spans[1].textContent : slug;
    wrap.innerHTML = sheetImg({ slug, name, image: '' });
  });
}
seedStaticSheetImages();

export function initNavCollections() {
  // Dynamic import: a Firebase/network hiccup here must not prevent the
  // static default sheet images above from having already applied, and
  // must leave the rest of the nav showing its last-known-good state
  // (initial static markup on first load) instead of going blank.
  import('./collections-store.js').then(({ onCollectionsUpdate }) => {
    onCollectionsUpdate(cols => {
      document.querySelectorAll('[data-collections-nav="desktop"]').forEach(el => renderInto(el, cols, buildDesktopCard));
      document.querySelectorAll('[data-collections-nav="mobile"]').forEach(el => renderInto(el, cols, c => buildMobileNode(el, c)));
      document.querySelectorAll('[data-collections-nav="sheet"]').forEach(el => renderInto(el, cols, buildSheetItem));
    }, e => {
      console.error('[nav-collections] no se pudieron sincronizar las colecciones:', e.code, e.message);
    });
  }).catch(e => {
    console.warn('[nav-collections] Firestore sync no disponible, quedan los valores estáticos:', e);
  });
}

initNavCollections();

// Exported for catalogo.html/collections.html/index.html's own page-specific
// renderers, which need the same slug-from-href convention and image
// helpers without re-implementing them.
export { slugFromHref, sheetImg, COLL_IMG_BASE, COLL_PLACEHOLDER, collImgFile };
