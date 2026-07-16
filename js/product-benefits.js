(function(){
'use strict';
if (window.TintinProductBenefitsBooted) return;
window.TintinProductBenefitsBooted = true;

// Cada tarjeta muestra el emoji configurado por defecto. Si en el futuro se
// quiere reemplazar un ícono por un PNG propio, basta con agregar
// data-icon-img="ruta/al/archivo.png" a la tarjeta en el HTML — se muestra
// la imagen en lugar del emoji, igual que en el diseño original.
document.querySelectorAll('.tinben-card[data-icon-img]').forEach(function(card){
  var src = card.getAttribute('data-icon-img');
  var iconEl = card.querySelector('.tinben-icon');
  if (!src || !iconEl) return;
  iconEl.innerHTML = '';
  var img = document.createElement('img');
  img.className = 'tinben-icon-img';
  img.loading = 'lazy';
  img.width = 60;
  img.height = 60;
  img.alt = card.getAttribute('data-title') || '';
  img.src = src;
  iconEl.appendChild(img);
});
})();
