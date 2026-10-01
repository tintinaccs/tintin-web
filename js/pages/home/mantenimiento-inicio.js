/* =============================================================
   TINTIN — Ajustes de página de la página principal
   =============================================================
   Sólo pulido de página: color de tema, año del pie, geometría de imágenes y
   la marca `tt-home-runtime-ready` que habilita las transiciones CSS.

   NO pinta ni limpia productos/combinaciones ni libera el loader:
   - Productos y "Completá tu look": tienda.js es el único dueño (esqueleto,
     error con reintento real, vacío y tarjetas).
   - Loader: lo libera el script inline de index.html.
   - Visibilidad/`inert` de secciones: la gobiernan el store gate y los
     paneles; esta capa nunca la revierte.
   ============================================================= */

const HOME_PATH_RE = /(?:^|\/)(?:index\.html)?\/?$/i;
const isHome = HOME_PATH_RE.test(window.location.pathname || '');

if (isHome && !window.TintinHomeMaintenanceBooted) {
  window.TintinHomeMaintenanceBooted = true;

  function updateThemeColor() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand-primary')
      .trim();
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value);
    }
  }

  function updateFooterYear() {
    const footer = document.querySelector('.tt-footer-bottom');
    if (!footer) return;
    const currentYear = String(new Date().getFullYear());
    footer.textContent = footer.textContent.replace(/©\s*\d{4}(?:-\d{4})?/i, `© 2024-${currentYear}`);
  }

  function ensureImageGeometry() {
    document.querySelectorAll([
      '.tt-editorial-img img',
      '.tt-watch-feature-img img',
      '.tt-coll-card-img img',
      '.tt-product-img img',
      '.tt-look-card-img img',
    ].join(',')).forEach(img => {
      if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.getAttribute('loading') && img.id !== 'tt-hero-img') img.setAttribute('loading', 'lazy');
    });
  }

  function markReady() {
    document.body?.classList.add('tt-home-runtime-ready');
  }

  function boot() {
    updateThemeColor();
    updateFooterYear();
    ensureImageGeometry();
    requestAnimationFrame(() => requestAnimationFrame(markReady));

    // Las tarjetas se re-pintan con datos en vivo: las nuevas imágenes también
    // necesitan decoding/loading. Sólo eventos reales, sin temporizadores.
    ['tintin:products-loaded', 'tintin:content-updated', 'tintin:images-updated']
      .forEach(name => window.addEventListener(name, ensureImageGeometry));

    new MutationObserver(updateThemeColor)
      .observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
