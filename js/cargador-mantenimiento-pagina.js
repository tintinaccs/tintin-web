function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

// Mismo ?v= que inyecta functions/[page].js: una sola instancia del módulo por página.
const INSTITUTIONAL_RUNTIME_VERSION = 'tintin-20260913-xss-hardening-1-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1-brand-runtime-20261004-1-owner-pink-20261004-1-first-render-merge-20261010-1';
const CONTACT_RUNTIME_VERSION = 'tintin-20261010-registration-name-2-first-render-merge-20261010-1';

function load(file, version = 'tintin-20261009-whatsapp-responsive-1') {
  return import(`./${file}?v=${version}`);
}

// Las páginas informativas no muestran productos al entrar. El store instala
// estas mismas políticas antes de publicar productos si se abre búsqueda o
// catálogo desde cualquier ruta; no se descargan colecciones sólo por leer
// envíos, contacto o textos legales.
if (!/\/(?:about|nosotros|contact|envios|cambios-devoluciones|preguntas-frecuentes|terminos|privacidad)(?:\.html)?$/.test(pathName())) {
  Promise.all([
    load('pages/catalog/politica-visibilidad-catalogo.js', 'tintin-20261015-integrated-politica-visibilidad-catalogo-1'),
    load('pages/catalog/prioridad-stock-catalogo.js', 'tintin-20260731-stock-priority-1-stock-flow-20261014-1'),
  ]).catch(error => console.warn('[PageMaintenance] No se pudo cargar la política de catálogo:', error));
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/mantenimiento-catalogo.js', 'tintin-20261010-whatsapp-release-5-palette-20261014-1');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/mantenimiento-colecciones.js', 'tintin-20260927-visual-1-brand-20261004-1-owner-pink-20261004-1-master-20261007-1');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/mantenimiento-producto.js', 'tintin-20261012-auth-privacy-1-mantenimiento-producto-js-domain-prepared-20261012-6-precutover-20261013-2-security-ready-20261013-2-palette-20261014-1-ui-reconciled-20261014-1-ui-reconciled-20261014-1');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    const version = 'tintin-20261009-whatsapp-responsive-1-photos-20261008-1';
    const stateVersion = 'tintin-20260912-checkout-state-navigation-1-repair-20261005-1';
    return Promise.allSettled([
      load('pages/checkout/checkout-hardening.js', 'tintin-20261012-checkout-ready-3-checkout-hardening-js-domain-prepared-20261012-6-precutover-20261013-3-security-ready-20261013-2-stock-flow-20261014-1-ui-reconciled-20261014-1-ui-reconciled-20261014-1'),
      load('pages/checkout/checkout-mantenimiento.js', 'tintin-20261012-checkout-ready-2-checkout-mantenimiento-js-palette-20261014-1'),
      load('pages/checkout/checkout-metodos-pago.js', 'tintin-20261012-checkout-ready-3-checkout-metodos-pago-js-domain-prepared-20261012-6-precutover-20261013-3-security-ready-20261013-2-palette-20261014-1'),
      load('pages/checkout/checkout-control-cuota.js', 'tintin-20261004-final-integration-2-master-20261007-1-encomienda-20261008-1-checkout-20261008-2-photos-20261008-1'),
      load('pages/checkout/estado-navegacion-checkout.js', 'tintin-20261012-checkout-ready-3-estado-navegacion-checkout-js')
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) {
    return load('pages/login/mantenimiento-acceso.js', 'tintin-20261012-auth-privacy-1-mantenimiento-acceso-js-domain-prepared-20261012-6-precutover-20261013-2-security-ready-20261013-2-palette-20261014-1-ui-reconciled-20261014-1-ui-reconciled-20261014-1');
  }
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/mantenimiento-perfil.js', 'tintin-20261008-producto-superficies-1-first-render-merge-20261010-1');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-nosotros.js', 'tintin-20260927-visual-1-brand-20261004-1-owner-pink-20261004-1-master-20261007-1-palette-20261014-1-story-20261014-1-story-20261014-1');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-contacto.js', 'tintin-20261012-auth-privacy-1-mantenimiento-contacto-js-domain-prepared-20261012-6-precutover-20261013-2-security-ready-20261013-2');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/mantenimiento-legal.js', 'tintin-20261012-auth-privacy-1-mantenimiento-legal-js-domain-prepared-20261012-6-precutover-20261013-2-security-ready-20261013-2');
  }
  return Promise.resolve();
}

loadPageMaintenance();
