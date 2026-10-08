/** Tiñe el logo oficial por su alfa, sin modificar el archivo ni fotos. */
(function () {
  'use strict';
  if (document.getElementById('tt-brand-logo-tint-defs')) return;
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'tt-brand-logo-tint-defs';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
  svg.innerHTML = '<defs><filter id="tt-brand-logo-tint" color-interpolation-filters="sRGB"><feFlood flood-color="#F8AACA" style="flood-color:var(--color-brand-primary,#F8AACA)"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>';
  if (document.body) document.body.appendChild(svg);
  else document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(svg);
  }, { once: true });
  var style = document.createElement('style');
  style.id = 'tt-brand-logo-tint-style';
  style.textContent = 'html body img[src*="/images/general/logo.png"]:not(#tt-loader-logo){filter:url("#tt-brand-logo-tint")!important}html body :is(#account-drawer,#cart-drawer,#notifications-drawer,#collections-sheet) img[src*="/images/general/logo.png"]{filter:brightness(0) invert(1)!important}';
  document.head.appendChild(style);
})();
