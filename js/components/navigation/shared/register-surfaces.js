function element(id) {
  return document.getElementById(id);
}

function resetSearchPanel() {
  const input = element('search-input');
  const results = element('search-results');
  if (input) input.value = '';
  if (results) {
    results.hidden = false;
    results.style.display = 'none';
    results.replaceChildren();
    results.removeAttribute('aria-activedescendant');
  }
}

async function refreshCartBeforeOpen() {
  document.dispatchEvent(new CustomEvent('tintin:cart-open-request'));
  try {
    await window.renderCart?.();
    window.updateCartBadge?.();
  } catch (error) {
    console.warn('[Navigation] No se pudo actualizar el carrito antes de abrir.', error);
  }
}

export async function registerNavigationSurfaces() {
  if (document.documentElement.dataset.ttModularSurfacesReady === '1') {
    return window.TintinSurfaceController || null;
  }

  const controller = await (window.TintinSurfaceControllerReady || Promise.resolve(window.TintinSurfaceController));
  if (!controller) throw new Error('TintinSurfaceController no está disponible');

  controller.connect({
    backdrop: element('tt-shared-backdrop'),
    morphLayer: element('tt-shared-morph'),
  });

  const registrations = [
    ['desktop-shop', {
      element: element('tt-tienda-dropdown-panel'),
      triggerSelector: '#btn-tienda',
      initialFocus: '.tt-dropdown-card',
      modal: false,
    }],
    ['tablet-menu', {
      element: element('tt-tablet-menu'),
      triggerSelector: '#btn-menu-tablet',
      initialFocus: '#btn-tablet-close',
    }],
    ['mobile-shop', {
      element: element('collections-sheet'),
      triggerSelector: '#tabbar-tienda',
      initialFocus: '#btn-close-sheet',
    }],
    ['search', {
      element: element('search-panel'),
      triggerSelector: '[data-nav-action="search"],#tabbar-search',
      initialFocus: '#search-input',
      afterClose: resetSearchPanel,
    }],
    ['cart', {
      element: element('cart-drawer'),
      triggerSelector: '[data-nav-action="cart"],#tabbar-cart',
      initialFocus: '#btn-cart-close',
      beforeOpen: refreshCartBeforeOpen,
    }],
    ['account', {
      element: element('account-drawer'),
      triggerSelector: '[data-nav-action="account"],#tabbar-cuenta',
      initialFocus: '#btn-account-close',
    }],
  ];

  registrations.forEach(([name, config]) => {
    if (config.element) controller.register(name, config);
  });

  document.documentElement.dataset.ttModularSurfacesReady = '1';
  document.documentElement.dataset.ttSurfacesReady = '1';
  document.dispatchEvent(new CustomEvent('tintin:modular-surfaces-ready', {
    detail: { controller },
  }));
  return controller;
}
