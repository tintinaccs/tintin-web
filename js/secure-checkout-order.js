import { auth, db } from './firebase.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { getCartLocal, setCartLocal, clearCart, cartTotal, formatPrice } from './cart-sync.js';
import { findCountryByCode, normalizePhone, isValidPhone } from './phone-utils.js';

if (!window.TintinSecureCheckoutOrderBooted) {
  window.TintinSecureCheckoutOrderBooted = true;

  const REQUEST_KEY = 'tt_secure_checkout_request_id';
  const callable = httpsCallable(getFunctions(getApp(), 'us-central1'), 'createOrder', { timeout: 45000 });
  let submitting = false;

  const text = value => String(value == null ? '' : value).trim();
  const escapeHtml = value => text(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function requestId() {
    try {
      let value = sessionStorage.getItem(REQUEST_KEY);
      if (!value) {
        value = window.crypto?.randomUUID
          ? window.crypto.randomUUID().replace(/-/g, '_')
          : `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(REQUEST_KEY, value);
      }
      return value;
    } catch {
      return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  function showError(message, reviewCart = false) {
    const box = document.getElementById('error-4');
    if (!box) return;
    box.innerHTML = reviewCart
      ? `<div>${escapeHtml(message)}</div><button type="button" id="tt-review-cart" style="margin-top:10px;border:0;border-radius:999px;background:#b84c72;color:#fff;padding:10px 18px;font-weight:700;cursor:pointer">Revisar carrito</button>`
      : escapeHtml(message);
    box.classList.add('show');
    document.getElementById('tt-review-cart')?.addEventListener('click', () => window.location.reload());
  }

  function hideError() {
    const box = document.getElementById('error-4');
    if (box) { box.classList.remove('show'); box.textContent = ''; }
  }

  function installLeafletCapture() {
    if (!window.L?.marker || window.L.__ttCheckoutCapture) return false;
    window.L.__ttCheckoutCapture = true;
    const original = window.L.marker;
    window.L.marker = function(...args) {
      const marker = original.apply(this, args);
      window.__TintinCheckoutMarker = marker;
      const save = () => {
        try {
          const p = marker.getLatLng();
          window.__TintinCheckoutPoint = { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) };
        } catch {}
      };
      marker.on?.('add move dragend', save);
      queueMicrotask(save);
      return marker;
    };
    return true;
  }

  const leafletTimer = window.setInterval(() => {
    if (installLeafletCapture()) window.clearInterval(leafletTimer);
  }, 300);

  function mapLocation() {
    let point = window.__TintinCheckoutPoint || null;
    try {
      const p = window.__TintinCheckoutMarker?.getLatLng?.();
      if (p) point = { lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) };
    } catch {}
    if (!point) {
      const match = (document.getElementById('ck-map-coords')?.textContent || '')
        .match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
      if (match) point = { lat: Number(match[1]), lng: Number(match[2]) };
    }
    if (!point) return null;
    return {
      ...point,
      name: text(document.getElementById('ck-location-name')?.value),
      address: text(document.getElementById('ck-address')?.value)
    };
  }

  function normalizeCities(list, fallback) {
    return (Array.isArray(list) ? list : []).map(item => {
      if (typeof item === 'string') return { name: item, price: Number(fallback || 0) };
      if (!item?.name) return null;
      if (item.price === null) return { name: item.name, price: null };
      return { name: item.name, price: Number(item.price === undefined ? fallback : item.price) };
    }).filter(Boolean);
  }

  function resolveShipping(settings) {
    const selected = text(document.getElementById('ck-city')?.value);
    if (selected === '__retiro__') return { method: 'retiro', city: 'San Lorenzo (retiro)', cost: 0, mapLocation: null };
    const wanted = selected.toLocaleLowerCase('es');
    const delivery = normalizeCities(settings.deliveryCities, settings.deliveryCost)
      .find(city => text(city.name).toLocaleLowerCase('es') === wanted);
    if (delivery) return { method: 'delivery', city: delivery.name, cost: delivery.price, mapLocation: mapLocation() };
    const encomienda = normalizeCities(settings.encomiendaCities, settings.encomiendaCost)
      .find(city => text(city.name).toLocaleLowerCase('es') === wanted);
    if (encomienda) return { method: 'encomienda', city: encomienda.name, cost: encomienda.price, mapLocation: null };
    throw new Error('SHIPPING_INVALID');
  }

  function readPhone() {
    const raw = text(document.getElementById('ck-phone-number')?.value);
    const country = findCountryByCode(document.getElementById('ck-phone-country')?.value);
    if (!country || !isValidPhone(raw, country)) throw new Error('PHONE_INVALID');
    return normalizePhone(raw, country).value;
  }

  async function buildPayload() {
    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    if (!settingsSnap.exists()) throw new Error('SETTINGS_MISSING');
    const settings = settingsSnap.data() || {};
    const items = getCartLocal();
    if (!items.length) throw new Error('EMPTY_CART');

    const shipping = resolveShipping(settings);
    const name = text(document.getElementById('ck-name')?.value);
    const address = text(document.getElementById('ck-address')?.value);
    const paymentMethod = text(document.querySelector('input[name="ck-pay"]:checked')?.value);
    if (!name) throw new Error('NAME_REQUIRED');
    if (!paymentMethod) throw new Error('PAYMENT_REQUIRED');
    if (shipping.method === 'delivery' && (!shipping.mapLocation || !shipping.mapLocation.name)) throw new Error('MAP_REQUIRED');
    if (shipping.method === 'encomienda' && address.length < 5) throw new Error('ADDRESS_REQUIRED');

    const subtotal = cartTotal(items);
    const shippingCost = shipping.cost === null ? null : Number(shipping.cost || 0);
    return {
      requestId: requestId(),
      items: items.map(item => ({ id: String(item.id), qty: Number(item.qty || 1), variant: text(item.variant) })),
      name,
      phone: readPhone(),
      contactEmail: text(document.getElementById('ck-email')?.value).toLowerCase(),
      notes: text(document.getElementById('ck-notes')?.value),
      shippingMethod: shipping.method,
      city: shipping.city,
      address,
      referencia: text(document.getElementById('ck-referencia')?.value),
      mapLocation: shipping.mapLocation,
      paymentMethod,
      expectedSubtotal: subtotal,
      expectedShippingCost: shippingCost,
      expectedTotal: subtotal + (shippingCost || 0)
    };
  }

  function updateCartFromQuote(quote) {
    const oldById = new Map(getCartLocal().map(item => [String(item.id), item]));
    setCartLocal((quote.items || []).map(item => ({
      ...(oldById.get(String(item.id)) || {}),
      id: item.id,
      name: item.name,
      cat: item.cat || '',
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      variant: item.variant || '',
      imageUrl: item.imageUrl || '',
      imgUrl: item.imageUrl || ''
    })));

    const target = document.getElementById('ck-confirm-summary');
    if (!target) return;
    target.innerHTML = `
      <div class="ck-summary-items">${(quote.items || []).map(item => `
        <div class="ck-summary-item"><span class="ck-summary-item-name">${item.qty}x ${escapeHtml(item.name)}</span><span style="font-weight:700">${formatPrice(item.price * item.qty)}</span></div>`).join('')}</div>
      <div class="ck-summary-total" style="margin-top:16px"><span>Subtotal</span><span class="ck-summary-total-val">${formatPrice(quote.subtotal)}</span></div>
      <div class="ck-summary-total"><span>Costo de envío</span><span class="ck-summary-total-val">${quote.shippingPending ? 'A confirmar' : formatPrice(quote.shippingCost || 0)}</span></div>
      <div class="ck-summary-total" style="font-size:18px"><span>TOTAL${quote.shippingPending ? ' (+ envío)' : ''}</span><span class="ck-summary-total-val">${formatPrice(quote.total)}</span></div>`;
  }

  function success(result) {
    window._lastOrderId = result.shortId;
    document.getElementById('ck-review-head')?.style.setProperty('display', 'none');
    document.getElementById('ck-success-head')?.style.setProperty('display', 'block');
    document.getElementById('ck-confirm-btn')?.style.setProperty('display', 'none');
    document.getElementById('ck-post-confirm')?.style.setProperty('display', 'block');
    const number = document.getElementById('ck-order-num');
    if (number) { number.style.display = 'block'; number.textContent = `N° de pedido: ${result.shortId}`; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function message(error) {
    const code = error?.details?.code || error?.message;
    const messages = {
      EMPTY_CART: 'Tu carrito está vacío.', NAME_REQUIRED: 'Ingresá tu nombre completo.',
      PHONE_INVALID: 'Ingresá un teléfono o WhatsApp válido.', PAYMENT_REQUIRED: 'Seleccioná un método de pago.',
      MAP_REQUIRED: 'Marcá y nombrá tu ubicación en el mapa.', ADDRESS_REQUIRED: 'Ingresá la dirección para la encomienda.',
      SHIPPING_INVALID: 'La ciudad elegida ya no está disponible.', SETTINGS_MISSING: 'No pudimos comprobar la configuración de la tienda.',
      email_not_verified: 'Tu correo debe estar verificado.', blocked_account: 'Esta cuenta está bloqueada.',
      store_closed: 'La tienda está temporalmente cerrada.', payment_unavailable: 'Ese método de pago ya no está disponible.',
      shipping_city_unavailable: 'La ciudad elegida ya no está disponible.', map_location_required: 'Marcá y nombrá tu ubicación en el mapa.',
      address_required: 'Ingresá la dirección para la encomienda.', store_config_unavailable: 'No pudimos comprobar los precios y métodos de entrega.'
    };
    if (messages[code]) return messages[code];
    if (error?.code === 'functions/unauthenticated') return 'Necesitás iniciar sesión para confirmar el pedido.';
    if (error?.code === 'functions/not-found' || error?.code === 'functions/unavailable') return 'El sistema seguro de pedidos todavía no está disponible.';
    if (error?.code === 'functions/deadline-exceeded') return 'La confirmación tardó demasiado. Volvé a intentar: el pedido no se duplicará.';
    return 'No pudimos confirmar el pedido. Intentá nuevamente.';
  }

  async function submit(button) {
    if (submitting) return;
    submitting = true;
    hideError();
    button.disabled = true;
    button.innerHTML = '<span class="ck-spinner"></span> Comprobando precios y stock…';
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous || !user.emailVerified) throw Object.assign(new Error('LOGIN'), { code: 'functions/unauthenticated' });
      await user.getIdToken(true).catch(() => {});
      const payload = await buildPayload();
      const result = (await callable(payload))?.data;
      if (!result?.success) throw new Error('NO_CONFIRMATION');
      await clearCart();
      try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
      success(result);
    } catch (error) {
      console.error('[secure-checkout]', error);
      const code = error?.details?.code;
      if (code === 'quote_changed' && error.details?.quote) {
        updateCartFromQuote(error.details.quote);
        showError('Cambió un precio o el costo de envío. Revisá el resumen actualizado y confirmá nuevamente.');
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido actualizado';
      } else if (code === 'insufficient_stock') {
        const id = String(error.details?.productId || '');
        const available = Number(error.details?.available || 0);
        setCartLocal(getCartLocal().map(item => String(item.id) === id ? (available > 0 ? { ...item, qty: Math.min(item.qty, available) } : null) : item).filter(Boolean));
        button.disabled = true;
        button.textContent = 'Revisá el carrito para continuar';
        showError(available > 0 ? `Cambió el stock. Dejamos la cantidad disponible: ${available}.` : 'Uno de los productos se agotó y lo quitamos del carrito.', true);
      } else if (code === 'product_not_found' || code === 'product_inactive') {
        button.disabled = true;
        button.textContent = 'Revisá el carrito para continuar';
        showError('Uno de los productos ya no está disponible.', true);
      } else {
        showError(message(error));
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido';
      }
    } finally {
      submitting = false;
    }
  }

  window.addEventListener('click', event => {
    const button = event.target?.closest?.('#ck-confirm-btn');
    if (!button || button.style.display === 'none') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    submit(button);
  }, true);
}
