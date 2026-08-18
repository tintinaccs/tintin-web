(function(){
'use strict';
if (window.TintinProductSelectionBooted) return;
window.TintinProductSelectionBooted = true;

var root = document.getElementById('tinsel-root');
if (!root) return; // esta sección solo existe en product.html

// Ícono de corazón compartido (mismo path que js/components/favorites/icono-corazon.js;
// este archivo es un IIFE clásico y no puede usar import).
var TT_HEART_PATH_D = 'M12 21s-6.716-4.35-9.428-8.485C.79 9.702 1.5 6.06 4.5 4.5 7.03 3.18 9.79 4.06 12 6.5c2.21-2.44 4.97-3.32 7.5-2C22.5 6.06 23.21 9.702 21.428 12.515 18.716 16.65 12 21 12 21z';
function heartIconMarkup(filled) {
  return filled
    ? '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false"><path d="' + TT_HEART_PATH_D + '"/></svg>'
    : '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="' + TT_HEART_PATH_D + '"/></svg>';
}

var skeleton    = document.getElementById('tinsel-skeleton');
var itemsEl     = document.getElementById('tinsel-items');
var footerEl    = document.getElementById('tinsel-footer');
var countEl     = document.getElementById('tinsel-count');
var totalHeadEl = document.getElementById('tinsel-total-head');
var totalFootEl = document.getElementById('tinsel-total-footer');
var toastEl     = document.getElementById('tinsel-toast');
var cartBtn     = document.getElementById('tinsel-cart-btn');
var checkoutBtn = document.getElementById('tinsel-checkout-btn');

function escapeHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function fmt(n){
  if (typeof window.formatPrice === 'function') return window.formatPrice(Math.round(n));
  return 'Gs. ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

var toastTimer;
function showToast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2800);
}

function getItems(){
  if (typeof window.syncCartWithCatalog === 'function') return window.syncCartWithCatalog();
  if (typeof window.getCart === 'function') return window.getCart();
  return [];
}

function render(){
  var items = getItems();
  var count = items.reduce(function(sum, item){ return sum + item.qty; }, 0);
  var total = items.reduce(function(sum, item){ return sum + item.price * item.qty; }, 0);

  if (countEl) countEl.textContent = String(count);
  var totalStr = fmt(total);
  if (totalHeadEl) totalHeadEl.textContent = totalStr;
  if (totalFootEl) totalFootEl.textContent = totalStr;

  if (skeleton) skeleton.style.display = 'none';

  if (!items.length) {
    if (itemsEl) {
      itemsEl.style.display = 'flex';
      itemsEl.innerHTML = '<div class="tinsel-empty"><div class="tinsel-empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div><p>Todavía no agregaste accesorios. ¡Empezá eligiendo!</p></div>';
    }
    if (footerEl) footerEl.style.display = 'none';
    return;
  }

  if (itemsEl) {
    itemsEl.style.display = 'flex';
    itemsEl.innerHTML = items.map(function(item){
      var safeId = escapeHtml(item.id);
      var safeName = escapeHtml(item.name);
      var safeVariant = escapeHtml(item.variant || '');
      var safeVariantAttr = escapeHtml(item.variant || '');
      var img = item.imageUrl || item.imgUrl || '';
      var url = '/product?id=' + encodeURIComponent(item.id);
      var isFavorite = Boolean(window.TintinFavorites && window.TintinFavorites.has && window.TintinFavorites.has(item.id));
      return (
        '<div class="tinsel-item" data-id="' + safeId + '">' +
          '<a class="tinsel-item-img" href="' + url + '">' +
            (img ? '<img src="' + escapeHtml(img) + '" alt="' + safeName + '" loading="lazy" width="76" height="76">' : '') +
          '</a>' +
          '<div class="tinsel-item-info">' +
            '<a class="tinsel-item-name" href="' + url + '">' + safeName + '</a>' +
            (item.variant ? '<p class="tinsel-item-variant">' + safeVariant + '</p>' : '') +
            '<p class="tinsel-item-price">' + fmt(item.price * item.qty) + '</p>' +
          '</div>' +
          '<div class="tinsel-qty">' +
            '<button type="button" class="tinsel-qbtn" data-cart-action="quantity" data-cart-id="' + safeId + '" data-cart-variant="' + safeVariantAttr + '" data-cart-delta="-1" aria-label="Restar">−</button>' +
            '<span class="tinsel-qnum">' + item.qty + '</span>' +
            '<button type="button" class="tinsel-qbtn" data-cart-action="quantity" data-cart-id="' + safeId + '" data-cart-variant="' + safeVariantAttr + '" data-cart-delta="1" aria-label="Sumar">+</button>' +
          '</div>' +
          '<div class="tinsel-item-actions">' +
            '<button type="button" class="tinsel-favorite' + (isFavorite ? ' is-favorite' : '') + '" data-favorite-id="' + safeId + '" data-favorite-name="' + safeName + '" data-favorite-price="' + escapeHtml(item.price) + '" data-favorite-image="' + escapeHtml(img) + '" aria-pressed="' + isFavorite + '"><span data-favorite-icon aria-hidden="true">' + heartIconMarkup(isFavorite) + '</span></button>' +
            '<button type="button" class="tinsel-del" data-cart-action="remove" data-cart-id="' + safeId + '" data-cart-variant="' + safeVariantAttr + '" data-tinsel-remove="1" aria-label="Eliminar">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  if (footerEl) footerEl.style.display = 'flex';
}

// Delegado propio (corre antes que el listener global de tienda.js, ya que
// este está más cerca del elemento clickeado en la fase de propagación):
// solo se ocupa de mostrar el toast de "eliminado"; el cambio real de
// cantidad/eliminación lo maneja el listener global [data-cart-action] que
// ya usa el resto del sitio (carrito lateral, checkout), para no duplicar
// esa lógica ni desincronizar el carrito real.
if (itemsEl) {
  itemsEl.addEventListener('click', function(e){
    var btn = e.target.closest('[data-tinsel-remove]');
    if (btn) showToast('Eliminado de tu selección');
  });
}

// tt_cart_updated cubre cambios externos (sincronizacion-carrito.js, otra pestaña, otro
// dispositivo vía Firestore) — pero ese módulo se importa dinámicamente y
// puede tardar unos instantes en cargar. El carrito lateral nativo del sitio
// no depende de ese evento para los clics locales: updateQty/removeFromCart/
// addToCart llaman a su propio renderCart() de inmediato. Envolvemos esas
// mismas funciones para que "Tu selección" se actualice igual de instantáneo
// ante un clic en esta misma página, sin esperar a que sincronizacion-carrito.js cargue.
['updateQty', 'removeFromCart', 'addToCart'].forEach(function(fnName){
  var original = window[fnName];
  if (typeof original !== 'function') return;
  window[fnName] = function(){
    var result = original.apply(this, arguments);
    render();
    return result;
  };
});

window.addEventListener('tt_cart_updated', render);
window.addEventListener('tintin:favorites-updated', render);
window.addEventListener('tintin:products-loaded', render);

document.addEventListener('visibilitychange', function(){
  if (!document.hidden) render();
});

if (cartBtn) cartBtn.addEventListener('click', function(){
  if (typeof window.openCart === 'function') window.openCart(cartBtn);
});

if (checkoutBtn) checkoutBtn.addEventListener('click', function(){
  if (typeof window.goToCheckout === 'function') window.goToCheckout();
  else window.location.href = '/checkout';
});

render();
})();
