import './phase7-catalog-policy.js?v=tintin-20260730-stock-visibility-1';
import './pages/catalog/catalog-stock-priority.js?v=tintin-20260731-stock-priority-1';

function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

function load(file) {
  return import(`./${file}?v=tintin-20260720-read-budget-1`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/catalog-maintenance.js');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/collections-maintenance.js');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/product-maintenance.js');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    return Promise.allSettled([
      load('pages/checkout/checkout-maintenance.js'),
      load('pages/checkout/checkout-payment-methods.js'),
      load('pages/checkout/checkout-quota-guard.js')
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) return load('pages/login/login-maintenance.js');
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/profile-maintenance.js');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/about-maintenance.js');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/contact-maintenance.js');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/legal-maintenance.js');
  }
  return Promise.resolve();
}

loadPageMaintenance();
