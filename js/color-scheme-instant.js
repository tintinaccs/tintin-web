/**
 * TINTIN — Aplicación instantánea del esquema de colores (Super Admin →
 * Apariencia → Esquema global), SIN esperar a Firebase.
 *
 * Script clásico (no type="module"), cargado lo antes posible en <head>,
 * ANTES de cualquier hoja de estilos — se ejecuta de forma síncrona y
 * bloqueante para pintar con el último esquema conocido (cacheado por
 * js/color-scheme.js en la visita anterior) desde el primer frame, sin
 * parpadeo de "colores por defecto → colores reales" al cargar la página.
 * Si todavía no hay nada cacheado (primera visita), simplemente no hace
 * nada y css/color-tokens.css se encarga de los valores por defecto.
 */
(function () {
  try {
    var raw = localStorage.getItem('tt_color_scheme_global');
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!data || typeof data.tokens !== 'object') return;
    var root = document.documentElement;
    var k;
    for (k in data.tokens) {
      if (Object.prototype.hasOwnProperty.call(data.tokens, k)) {
        root.style.setProperty(k, data.tokens[k]);
      }
    }
    if (data.deviceOverrideEnabled && data.deviceOverrides) {
      var w = window.innerWidth;
      var bp = w >= 1440 ? 'desktopLg' : w >= 1200 ? 'desktop' : w >= 992 ? 'laptop' : w >= 768 ? 'tablet' : w >= 480 ? 'mobile' : 'miniMobile';
      var over = data.deviceOverrides[bp];
      if (over) {
        for (k in over) {
          if (Object.prototype.hasOwnProperty.call(over, k)) root.style.setProperty(k, over[k]);
        }
      }
    }
  } catch (e) { /* localStorage bloqueado o dato corrupto: no rompe la página */ }
})();
