import './pages/catalog/politica-visibilidad-catalogo.js?v=tintin-20261007-public-consistency-1-master-20261007-1-encomienda-20261008-1-photos-20261008-1-minimal-product-20261008-1';
import './pages/catalog/prioridad-stock-catalogo.js?v=tintin-20260731-stock-priority-1';

function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

// Mismo ?v= que inyecta functions/[page].js: una sola instancia del módulo por página.
const INSTITUTIONAL_RUNTIME_VERSION = 'tintin-20260913-xss-hardening-1-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1-brand-runtime-20261004-1-owner-pink-20261004-1';
const CONTACT_RUNTIME_VERSION = 'tintin-20261009-whatsapp-responsive-1';

function load(file, version = 'tintin-20261009-whatsapp-responsive-1') {
  return import(`./${file}?v=${version}`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/mantenimiento-catalogo.js', 'tintin-20261010-whatsapp-release-5');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/mantenimiento-colecciones.js', 'tintin-20260927-visual-1-brand-20261004-1-owner-pink-20261004-1-master-20261007-1');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/mantenimiento-producto.js', 'tintin-20261010-product-related-details-1-merge-spacing-20261010-1');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    const version = 'tintin-20261009-whatsapp-responsive-1-photos-20261008-1';
    const stateVersion = 'tintin-20260912-checkout-state-navigation-1-repair-20261005-1';
    return Promise.allSettled([
      load('pages/checkout/checkout-hardening.js', 'tintin-20261010-registration-name-2'),
      load('pages/checkout/checkout-mantenimiento.js', 'tintin-20261008-checkout-step-labels-1'),
      load('pages/checkout/checkout-metodos-pago.js', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2'),
      load('pages/checkout/checkout-control-cuota.js', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2-photos-20261008-1'),
      load('pages/checkout/estado-navegacion-checkout.js', 'tintin-20261010-whatsapp-release-5')
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) {
    return load('pages/login/mantenimiento-acceso.js', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2-loads-20261007-1');
  }
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/mantenimiento-perfil.js', 'tintin-20261008-producto-superficies-1');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-nosotros.js', 'tintin-20260927-visual-1-brand-20261004-1-owner-pink-20261004-1-master-20261007-1');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-contacto.js', 'tintin-20261010-registration-name-2');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/mantenimiento-legal.js', INSTITUTIONAL_RUNTIME_VERSION);
  }
  return Promise.resolve();
}

loadPageMaintenance();
