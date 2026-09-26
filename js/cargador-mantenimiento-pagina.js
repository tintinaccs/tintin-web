import './pages/catalog/politica-visibilidad-catalogo.js?v=tintin-20260925-cache-converge-1';
import './pages/catalog/prioridad-stock-catalogo.js?v=tintin-20260731-stock-priority-1';

function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

// Mismo ?v= que inyecta functions/[page].js: una sola instancia del módulo por página.
const INSTITUTIONAL_RUNTIME_VERSION = 'tintin-20260913-xss-hardening-1-auth-persistence-20260919-1-auth-popup-resolver-1';

function load(file, version = 'tintin-20260925-cache-converge-1') {
  return import(`./${file}?v=${version}`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/mantenimiento-catalogo.js');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/mantenimiento-colecciones.js');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/mantenimiento-producto.js');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    const version = 'tintin-20260925-cache-converge-1';
    const stateVersion = 'tintin-20260912-checkout-state-navigation-1';
    return Promise.allSettled([
      load('pages/checkout/checkout-hardening.js', version),
      load('pages/checkout/checkout-mantenimiento.js', version),
      load('pages/checkout/checkout-metodos-pago.js', version),
      load('pages/checkout/checkout-control-cuota.js', version),
      load('pages/checkout/estado-navegacion-checkout.js', stateVersion)
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) {
    return load('pages/login/mantenimiento-acceso.js', 'tintin-20260925-cache-converge-1');
  }
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/mantenimiento-perfil.js', 'tintin-20260908-profile-canonical-2');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-nosotros.js');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-contacto.js', INSTITUTIONAL_RUNTIME_VERSION);
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/mantenimiento-legal.js', INSTITUTIONAL_RUNTIME_VERSION);
  }
  return Promise.resolve();
}

loadPageMaintenance();
