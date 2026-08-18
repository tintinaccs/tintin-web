import { auth, db } from '../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from '../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';
import { doc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getCartLocal,
  setCartLocal,
  clearCart,
  cartTotal,
  formatPrice,
} from '../components/cart/sincronizacion-carrito.js?v=tintin-20260814-social-notifications-1';
import { findCountryByCode, normalizePhone, isValidPhone } from '../components/forms/utilidades-telefono.js?v=tintin-20260803-phone-unique-1';
import { createOrderViaServer } from '../create-order-client-v2.js?v=tintin-20260818-checkout-cloudflare-1';
import { composeCheckoutDraft } from './politica-checkout.js?v=tintin-20260808-contract-1';

if (!window.TintinSecureCheckoutOrderV2Booted) {
  window.TintinSecureCheckoutOrderV2Booted = true;

  if (!window.TintinCheckoutEmailBridgeLoading) {
    window.TintinCheckoutEmailBridgeLoading = true;
    import('../pages/checkout/checkout-puente-correo.js?v=tintin-20260814-social-notifications-1').catch(error => {
      console.error('[secure-checkout-v2] No se pudo cargar el puente de correo:', error);
    });
  }

  const REQUEST_KEY = 'tt_spark_checkout_request_id';
  const DEFAULT_STORE_WHATSAPP = '595981299331';
  const CHECKOUT_COOLDOWN_MS = 90 * 1000;
  let submitting = false;
  let inMemoryRequestId = '';

  const text = value => String(value == null ? '' : value).trim();
  const digits = (value, max = 40) => String(value == null ? '' : value).replace(/\D/g, '').slice(0, max);
  const escapeHtml = value => text(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function appError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.details = { code, ...details };
    return error;
  }

  function requestId() {
    try {
      let value = sessionStorage.getItem(REQUEST_KEY);
      if (!value || !/^[A-Za-z0-9_-]{12,100}$/.test(value)) {
        value = window.crypto?.randomUUID
          ? window.crypto.randomUUID().replace(/-/g, '_')
          : `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(REQUEST_KEY, value);
      }
      return value;
    } catch {
      if (!inMemoryRequestId) inMemoryRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
      return inMemoryRequestId;
    }
  }

  function showError(message, reviewCart = false) {
    const box = document.getElementById('error-4');
    if (!box) return;
    box.innerHTML = reviewCart
      ? `<div>${escapeHtml(message)}</div><button type="button" id="tt-review-cart" style="margin-top:10px;border:0;border-radius:999px;background:#b84c72;color:#fff;padding:10px 18px;font-weight:700;cursor:pointer">Revisar carrito</button>`
      : escapeHtml(message);
    box.classList.add('show');
    document.getElementById('tt-review-cart')?.addEventListener('click', () => window.TintinCheckoutInputEnhancements?.navigateBack?.(0));
  }

  function hideError() {
    const box = document.getElementById('error-4');
    if (!box) return;
    box.classList.remove('show');
    box.textContent = '';
  }

  function parseMoney(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;
    const parsed = Number(String(value == null ? '' : value).replace(/gs\.?/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  function normalizeCities(list, fallback) {
    return (Array.isArray(list) ? list : []).map((item, sourceIndex) => {
      if (typeof item === 'string') return { name: text(item), price: parseMoney(fallback), sourceIndex };
      if (!item?.name) return null;
      const price = item.price === null ? null : parseMoney(item.price === undefined ? fallback : item.price);
      return { name: text(item.name), price: Number.isFinite(price) ? price : null, sourceIndex };
    }).filter(Boolean);
  }

  function mergeShippingRates(settings, ratesSnap) {
    const rates = ratesSnap?.exists() ? ratesSnap.data() || {} : {};
    return {
      ...settings,
      deliveryCities: Array.isArray(rates.deliveryCities) ? rates.deliveryCities : settings.deliveryCities,
      encomiendaCities: Array.isArray(rates.encomiendaCities) ? rates.encomiendaCities : settings.encomiendaCities,
      deliveryCost: rates.deliveryCost != null ? rates.deliveryCost : settings.deliveryCost,
      encomiendaCost: rates.encomiendaCost != null ? rates.encomiendaCost : settings.encomiendaCost,
    };
  }

  function selectedEncomiendaMode() {
    if (document.getElementById('ck-enc-puerta')?.classList.contains('is-active')) return 'puerta';
    if (document.getElementById('ck-enc-agencia')?.classList.contains('is-active')) return 'agencia';
    return '';
  }

  function mapLocation() {
    const match = (document.getElementById('ck-map-coords')?.textContent || '').match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
    if (!match) return null;
    return {
      lat: Number(match[1]),
      lng: Number(match[2]),
      name: text(document.getElementById('ck-location-name')?.value),
      address: text(document.getElementById('ck-address')?.value),
    };
  }

  function resolveShipping(settings, selectedCity, location) {
    if (selectedCity === '__retiro__') return { method: 'retiro', city: 'Retiro coordinado', cost: 0, pending: false, rateIndex: -1, mapLocation: null };
    const wanted = text(selectedCity).toLocaleLowerCase('es');
    const delivery = normalizeCities(settings.deliveryCities, settings.deliveryCost).find(city => city.name.toLocaleLowerCase('es') === wanted);
    if (delivery) return { method: 'delivery', city: delivery.name, cost: delivery.price, pending: delivery.price === null, rateIndex: delivery.sourceIndex, mapLocation: location };
    const encomienda = normalizeCities(settings.encomiendaCities, settings.encomiendaCost).find(city => city.name.toLocaleLowerCase('es') === wanted);
    if (encomienda) {
      const mode = selectedEncomiendaMode();
      if (!mode) throw appError('shipping_invalid', 'Elegí si retirás en agencia o si la encomienda va hasta tu puerta.');
      return { method: 'encomienda', encomiendaMode: mode, city: encomienda.name, cost: 0, pending: false, rateIndex: encomienda.sourceIndex, mapLocation: mode === 'puerta' ? location : null };
    }
    throw appError('shipping_invalid', 'La ciudad elegida ya no está disponible.');
  }

  function readPhone() {
    const raw = text(document.getElementById('ck-phone-number')?.value);
    const country = findCountryByCode(document.getElementById('ck-phone-country')?.value);
    if (!country || !isValidPhone(raw, country)) throw appError('phone_invalid', 'Ingresá un teléfono o WhatsApp válido.');
    return normalizePhone(raw, country).value;
  }

  function readDocumentNumber(shippingMethod) {
    if (shippingMethod !== 'encomienda') return '';
    const raw = window.TintinCheckoutInputEnhancements?.documentNumberDigits?.()
      || digits(document.getElementById('ck-document-number')?.value, 8);
    if (!/^\d{6,8}$/.test(raw)) throw appError('document_invalid', 'Ingresá una cédula válida de 6 a 8 dígitos.');
    return raw;
  }

  async function buildDraft() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.emailVerified) throw appError('login_required', 'Necesitás iniciar sesión con un correo verificado.');
    const items = getCartLocal();
    if (!items.length) throw appError('empty_cart', 'Tu carrito está vacío.');

    const [settingsSnap, ratesSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'general')),
      getDoc(doc(db, 'settings', 'shippingRates')),
    ]);
    if (!settingsSnap.exists()) throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
    const settings = mergeShippingRates(settingsSnap.data() || {}, ratesSnap);
    const selectedCity = text(document.getElementById('ck-city')?.value);
    const shipping = resolveShipping(settings, selectedCity, mapLocation());
    const address = text(document.getElementById('ck-address')?.value);
    const paymentMethod = text(document.querySelector('input[name="ck-pay"]:checked')?.value);
    const name = text(document.getElementById('ck-name')?.value);

    if (name.length < 2) throw appError('name_required', 'Ingresá tu nombre completo.');
    if (!['efectivo', 'transferencia'].includes(paymentMethod)) throw appError('payment_required', 'Seleccioná un método de pago disponible.');
    if (shipping.method === 'delivery' && (!shipping.mapLocation || !shipping.mapLocation.name)) throw appError('map_required', 'Marcá y nombrá tu ubicación en el mapa.');
    if (shipping.method === 'encomienda' && shipping.encomiendaMode === 'puerta') {
      if (address.length < 5) throw appError('address_required', 'Ingresá la dirección para la entrega en puerta.');
      if (!shipping.mapLocation || !shipping.mapLocation.name) throw appError('map_required', 'Marcá y nombrá la ubicación para la entrega en puerta.');
    }

    const documentNumber = readDocumentNumber(shipping.method);
    return {
      ...composeCheckoutDraft({
        requestId: requestId(),
        items,
        name,
        phone: readPhone(),
        contactEmail: text(document.getElementById('ck-email')?.value).toLowerCase(),
        notes: text(document.getElementById('ck-notes')?.value).slice(0, 1000),
        selectedCity,
        departamento: text(document.getElementById('ck-departamento')?.value),
        address,
        referencia: text(document.getElementById('ck-referencia')?.value),
        shipping,
        paymentMethod,
        subtotal: cartTotal(items),
      }),
      documentNumber,
    };
  }

  async function reserveCheckoutGuard(draft) {
    const user = auth.currentUser;
    const orderId = `${user.uid}_${draft.requestId}`;
    const guardRef = doc(db, 'checkoutGuards', user.uid);
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(guardRef);
      const data = snap.exists() ? snap.data() || {} : {};
      const last = data.lastCheckoutAt;
      const lastMs = typeof last?.toMillis === 'function' ? last.toMillis() : Number(new Date(last || 0));
      const sameOrder = text(data.lastCheckoutOrderId) === orderId;
      if (!sameOrder && text(user.email).toLowerCase() !== SUPER_ADMIN_EMAIL && Number.isFinite(lastMs) && Date.now() - lastMs < CHECKOUT_COOLDOWN_MS) {
        const remaining = Math.max(1, Math.ceil((CHECKOUT_COOLDOWN_MS - (Date.now() - lastMs)) / 1000));
        throw appError('checkout_cooldown', 'Esperá un momento antes de crear otro pedido.', { remaining });
      }
      transaction.set(guardRef, { userId: user.uid, lastCheckoutAt: serverTimestamp(), lastCheckoutOrderId: orderId, updatedAt: serverTimestamp() }, { merge: true });
      return { orderId };
    }, { maxAttempts: 2 });
  }

  async function createOrderOnServer(draft) {
    const response = await createOrderViaServer(draft);
    if (!response || typeof response !== 'object') throw appError('server_error');
    if (response.ok !== true) {
      throw appError(response.error || 'server_error', undefined, {
        quote: response.quote,
        productId: response.productId,
        available: response.available,
        requested: response.requested,
      });
    }
    return { ...(response.order || {}), orderId: response.orderId };
  }

  function authoritativeCartFromQuote(quote) {
    const current = new Map(getCartLocal().map(item => [String(item.id), item]));
    return (quote.items || []).map(item => ({
      ...(current.get(String(item.id)) || {}), id: item.id, name: item.name, cat: item.cat || '',
      price: Number(item.price || 0), qty: Number(item.qty || 1), variant: item.variant || '',
      imageUrl: item.imageUrl || '', imgUrl: item.imageUrl || '',
    }));
  }

  function renderQuote(quote) {
    setCartLocal(authoritativeCartFromQuote(quote));
    const target = document.getElementById('ck-summary-quote') || document.getElementById('ck-confirm-summary');
    if (!target) return;
    target.innerHTML = `
      <div class="ck-summary-items">${(quote.items || []).map(item => `<div class="ck-summary-item"><span class="ck-summary-item-name">${item.qty}x ${escapeHtml(item.name)}</span><span style="font-weight:700">${formatPrice(item.price * item.qty)}</span></div>`).join('')}</div>
      <div class="ck-summary-total" style="margin-top:16px"><span>Subtotal</span><span class="ck-summary-total-val">${formatPrice(quote.subtotal)}</span></div>
      <div class="ck-summary-total"><span>Costo de envío</span><span class="ck-summary-total-val">${quote.shippingPending ? 'A confirmar' : formatPrice(quote.shippingCost || 0)}</span></div>
      <div class="ck-summary-total" style="font-size:18px"><span>TOTAL${quote.shippingPending ? ' (+ envío)' : ''}</span><span class="ck-summary-total-val">${formatPrice(quote.total)}</span></div>`;
  }

  const SHIPPING_LABELS = { retiro: 'Retiro en tienda', delivery: 'Delivery a domicilio', encomienda: 'Encomienda al interior' };
  const PAYMENT_LABELS = { efectivo: 'Efectivo contra entrega', transferencia: 'Transferencia bancaria' };

  function buildWhatsAppMessage(result, draft) {
    const items = (result.items || []).map(item => `• ${item.qty}x ${item.name} — ${formatPrice(item.price * item.qty)}`).join('\n');
    const lines = [
      `Hola, consulto por mi pedido *#${result.shortId}* (ya confirmado en la web).`, '', items, '',
      `💰 Total: ${formatPrice(result.total || 0)}${result.shippingPending ? ' + envío' : ''}`,
      `📦 Entrega: ${SHIPPING_LABELS[draft.shippingMethod] || draft.shippingMethod}`,
    ];
    if (draft.selectedCity && draft.selectedCity !== '__retiro__') lines.push(`📍 Ciudad: ${draft.selectedCity}`);
    if (draft.address) lines.push(`🏠 Dirección: ${draft.address}`);
    if (draft.documentNumber) lines.push(`🪪 Cédula: ${String(draft.documentNumber).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`);
    if (draft.paymentMethod) lines.push(`💳 Pago: ${PAYMENT_LABELS[draft.paymentMethod] || draft.paymentMethod}`);
    if (draft.name) lines.push('', `👤 ${draft.name}`);
    if (draft.phone) lines.push(`📱 ${draft.phone}`);
    return lines.join('\n');
  }

  function success(result, draft) {
    window._lastOrderId = result.shortId;
    document.getElementById('ck-review-head')?.style.setProperty('display', 'none');
    document.getElementById('ck-success-head')?.style.setProperty('display', 'block');
    document.getElementById('ck-confirm-btn')?.style.setProperty('display', 'none');
    document.getElementById('btn-step5-back')?.setAttribute('hidden', '');
    document.getElementById('ck-post-confirm')?.style.setProperty('display', 'block');
    const number = document.getElementById('ck-order-num');
    if (number) { number.style.display = 'block'; number.textContent = `N° de pedido: ${result.shortId}`; }
    const whatsapp = document.getElementById('ck-wa-support');
    if (whatsapp) {
      const phone = digits(result.storeWhatsapp || DEFAULT_STORE_WHATSAPP, 20);
      whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(result, draft))}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function message(error) {
    const code = error?.details?.code || error?.code || error?.message;
    const messages = {
      empty_cart: 'Tu carrito está vacío.', name_required: 'Ingresá tu nombre completo.',
      phone_invalid: 'Ingresá un teléfono o WhatsApp válido.', document_invalid: 'Ingresá una cédula válida de 6 a 8 dígitos para la encomienda.',
      payment_required: 'Seleccioná un método de pago.', map_required: 'Marcá y nombrá tu ubicación en el mapa.',
      address_required: 'Ingresá la dirección para la encomienda.', shipping_invalid: 'La ciudad elegida ya no está disponible.',
      shipping_changed: 'Cambió la configuración del envío. Volvé al paso de envío y revisala.',
      settings_missing: 'No pudimos comprobar la configuración de la tienda.', profile_missing: 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.',
      login_required: 'Necesitás iniciar sesión con un correo verificado.', blocked_account: 'Esta cuenta está bloqueada.',
      store_closed: 'La tienda está temporalmente cerrada.', payment_unavailable: 'Ese método de pago ya no está disponible.',
      checkout_guard_missing: 'No pudimos confirmar tu turno de compra. Volvé a intentar.', checkout_guard_expired: 'Pasó demasiado tiempo desde que confirmaste. Volvé a intentar.',
      missing_id_token: 'Necesitás iniciar sesión con un correo verificado.', server_error: 'No pudimos conectar con el servidor de pedidos. Intentá nuevamente.',
      transaction_begin_failed: 'No pudimos conectar con el servidor de pedidos. Intentá nuevamente.', batch_get_failed: 'No pudimos comprobar precios y stock. Intentá nuevamente.',
      commit_failed: 'No pudimos confirmar el pedido. Intentá nuevamente.', create_order_failed: 'No pudimos confirmar el pedido. Intentá nuevamente.',
      invalid_response: 'El servidor de pedidos devolvió una respuesta inválida. Intentá nuevamente.',
    };
    if (code === 'checkout_cooldown') return error?.details?.remaining ? `Esperá ${error.details.remaining} segundos antes de crear otro pedido.` : 'Esperá un momento antes de crear otro pedido.';
    return messages[code] || 'No pudimos confirmar el pedido. Intentá nuevamente.';
  }

  async function submit(button) {
    if (submitting) return;
    submitting = true;
    hideError();
    button.disabled = true;
    button.innerHTML = '<span class="ck-spinner"></span> Comprobando precios y stock…';
    try {
      const draft = await buildDraft();
      await reserveCheckoutGuard(draft);
      const result = await createOrderOnServer(draft);
      await clearCart();
      try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
      inMemoryRequestId = '';
      success(result, draft);
    } catch (error) {
      console.error('[spark-checkout-v2]', error);
      const code = error?.details?.code || error?.code;
      if (code === 'quote_changed' && error.details?.quote) {
        renderQuote(error.details.quote);
        showError('Cambió un precio o el stock mientras confirmabas. Revisá el resumen actualizado y confirmá nuevamente.');
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido actualizado';
      } else if (code === 'insufficient_stock') {
        const productId = String(error.details?.productId || '');
        const available = Number(error.details?.available || 0);
        setCartLocal(getCartLocal().map(item => String(item.id) === productId ? (available > 0 ? { ...item, qty: Math.min(Number(item.qty || 1), available) } : null) : item).filter(Boolean));
        button.disabled = true;
        button.textContent = 'Revisá el carrito para continuar';
        showError(available > 0 ? `Cambió el stock. Dejamos la cantidad disponible: ${available}.` : 'Uno de los productos se agotó y lo quitamos del carrito.', true);
      } else if (['product_not_found', 'product_inactive'].includes(code)) {
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
    void submit(button);
  }, true);
}
