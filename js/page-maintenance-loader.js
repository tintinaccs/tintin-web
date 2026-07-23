function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

function load(file) {
  return import(`./${file}?v=tintin-20260720-read-budget-1`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('catalog-maintenance.js');
  if (/\/collections(?:\.html)?$/.test(path)) return load('collections-maintenance.js');
  if (/\/product(?:\.html)?$/.test(path)) return load('product-maintenance.js');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    return Promise.allSettled([
      load('checkout-maintenance.js'),
      load('checkout-payment-methods.js'),
      load('checkout-quota-guard.js')
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) return load('login-maintenance.js');
  if (/\/perfil(?:\.html)?$/.test(path)) return load('profile-maintenance.js');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('about-maintenance.js');
  if (/\/contact(?:\.html)?$/.test(path)) return load('contact-maintenance.js');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('legal-maintenance.js');
  }
  return Promise.resolve();
}

loadPageMaintenance();
