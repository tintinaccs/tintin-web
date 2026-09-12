import './pages/catalog/politica-visibilidad-catalogo.js?v=tintin-20260821-accounts-phase-a-3';
import './pages/catalog/prioridad-stock-catalogo.js?v=tintin-20260731-stock-priority-1';

function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

function load(file, version = 'tintin-20260830-instant-loading-1') {
  return import(`./${file}?v=${version}`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/mantenimiento-catalogo.js');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/mantenimiento-colecciones.js');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/mantenimiento-producto.js');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    const version = 'tintin-20260907-checkout-shipping-step-1';
    const stateVersion = 'tintin-20260912-checkout-state-navigation-1';
    return Promise.allSettled([
      load('pages/checkout/checkout-hardening.js', version),
      load('pages/checkout/checkout-mantenimiento.js', version),
      load('pages/checkout/checkout-metodos-pago.js', version),
      load('pages/checkout/checkout-control-cuota.js', version),
      load('pages/checkout/estado-navegacion-checkout.js', stateVersion)
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) return load('pages/login/mantenimiento-acceso.js');
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/mantenimiento-perfil.js', 'tintin-20260908-profile-canonical-2');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-nosotros.js');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-contacto.js');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/mantenimiento-legal.js');
  }
  return Promise.resolve();
}

loadPageMaintenance();
