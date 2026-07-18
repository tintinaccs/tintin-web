/* TINTIN — runtime de mantenimiento para about.html */
(() => {
  const path = (location.pathname || '').toLowerCase();
  if (!/(?:^|\/)about(?:\.html)?\/?$/.test(path) || window.TintinAboutMaintenanceBooted) return;
  window.TintinAboutMaintenanceBooted = true;

  const addStylesheet = () => {
    if (document.querySelector('link[data-tt-about-maintenance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/about-maintenance.css?v=tintin-20260718-about-maintenance-1';
    link.dataset.ttAboutMaintenance = '1';
    document.head.appendChild(link);
  };

  const canonicalUrl = () => {
    const url = new URL('about.html', location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  };

  const setMeta = (selector, attribute, value) => {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attribute, value);
  };

  function normalizeMetadata() {
    const canonical = canonicalUrl();
    setMeta('link[rel="canonical"]', 'href', canonical);
    setMeta('meta[property="og:url"]', 'content', canonical);
    const cover = new URL('assets/og-cover.jpg', location.href).href;
    setMeta('meta[property="og:image"]', 'content', cover);
    setMeta('meta[name="twitter:image"]', 'content', cover);
  }

  function improveStructure() {
    document.documentElement.classList.add('tt-about-maintained');
    document.body?.classList.add('tt-about-maintained');

    const valuesGrid = document.querySelector('.tt-trust-grid');
    if (valuesGrid) {
      valuesGrid.setAttribute('role', 'list');
      valuesGrid.querySelectorAll('.tt-trust-item').forEach(item => item.setAttribute('role', 'listitem'));
    }

    const valuesHeading = document.querySelector('.tt-trust-bar .container > div');
    valuesHeading?.classList.add('tt-values-heading');

    const actions = document.querySelector('.tt-about-content > div[style*="margin-top"]');
    actions?.classList.add('tt-about-actions');

    const mission = [...document.querySelectorAll('.tt-about-text')]
      .find(node => /nuestra misión/i.test(node.textContent || ''));
    mission?.classList.add('tt-about-mission');

    const deliveryCopy = [...document.querySelectorAll('.tt-about-text')]
      .find(node => /envío el mismo día|pedidos antes de las/i.test(node.textContent || ''));
    if (deliveryCopy) {
      deliveryCopy.textContent = 'Coordinamos entregas en zona central y realizamos envíos a todo Paraguay. Los horarios, costos y disponibilidad se confirman al momento de hacer tu pedido.';
    }
  }

  function improveImage() {
    const wrapper = document.querySelector('[data-img-slot="about_foto"]');
    const image = wrapper?.querySelector('img');
    if (!wrapper || !image) return;
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', image.alt || 'Tintin Accesorios y Relojes');
    image.addEventListener('load', () => wrapper.classList.remove('is-error'), { once: true });
    image.addEventListener('error', () => {
      wrapper.classList.add('is-error');
      image.hidden = true;
    });
  }

  function updateFooterYear() {
    const footer = document.querySelector('.tt-footer-bottom');
    if (!footer) return;
    footer.textContent = `© 2024-${new Date().getFullYear()} TINTIN ACCESORIOS — TODOS LOS DERECHOS RESERVADOS`;
  }

  function ready() {
    addStylesheet();
    normalizeMetadata();
    improveStructure();
    improveImage();
    updateFooterYear();
    window.ttPageReady?.();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();

  window.addEventListener('pageshow', () => {
    normalizeMetadata();
    updateFooterYear();
  });
})();
