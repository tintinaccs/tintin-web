import './pages/catalog/politica-visibilidad-catalogo.js?v=tintin-20260818-products-unified-2';
import './pages/catalog/prioridad-stock-catalogo.js?v=tintin-20260731-stock-priority-1';

function pathName() {
  return location.pathname.toLowerCase().replace(/\/+$/, '');
}

function load(file) {
  return import(`./${file}?v=tintin-20260817-mobile-accordion-1`);
}

export function loadPageMaintenance() {
  const path = pathName();
  if (/\/catalogo(?:\.html)?$/.test(path)) return load('pages/catalog/mantenimiento-catalogo.js');
  if (/\/collections(?:\.html)?$/.test(path)) return load('pages/collections/mantenimiento-colecciones.js');
  if (/\/product(?:\.html)?$/.test(path)) return load('pages/product/mantenimiento-producto.js');
  if (/\/checkout(?:\.html)?$/.test(path)) {
    return Promise.allSettled([
      load('pages/checkout/checkout-mantenimiento.js'),
      load('pages/checkout/checkout-metodos-pago.js'),
      load('pages/checkout/checkout-control-cuota.js')
    ]);
  }
  if (/\/login(?:\.html)?$/.test(path)) return load('pages/login/mantenimiento-acceso.js');
  if (/\/perfil(?:\.html)?$/.test(path)) return load('pages/profile/mantenimiento-perfil.js');
  if (/\/(?:about|nosotros)(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-nosotros.js');
  if (/\/contact(?:\.html)?$/.test(path)) return load('pages/institutional/mantenimiento-contacto.js');
  if (/\/(?:terminos|privacidad)(?:\.html)?$/.test(path)) {
    return load('pages/institutional/mantenimiento-legal.js');
  }
  return Promise.resolve();
}

loadPageMaintenance();
