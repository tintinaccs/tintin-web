import { auth, db } from '../core/firebase/firebase.js?v=tintin-20260730-appcheck-stable-4';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from '../core/auth/roles.js?v=tintin-20260716-cloudinary-fix-1';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getCartLocal,
  setCartLocal,
  clearCart,
  cartTotal,
  formatPrice
} from '../components/cart/sincronizacion-carrito.js?v=tintin-20260811-phonefix-sincronizacion-carrito-1';
import {
  findCountryByCode,
  normalizePhone,
  isValidPhone
} from '../components/forms/utilidades-telefono.js?v=tintin-20260803-phone-unique-1';
import { createOrderViaServer } from '../create-order-client.js?v=tintin-20260811-phone-order-1';
import { composeCheckoutDraft } from './politica-checkout.js?v=tintin-20260808-contract-1';

if (!window.TintinSecureCheckoutOrderBooted) {
  window.TintinSecureCheckoutOrderBooted = true;

  // El puente que dispara el correo de confirmación del pedido
  // (checkout-puente-correo.js) se cargaba como efecto secundario de
  // importar js/email/notificaciones-correo.js — pero desde la migración a Resend (PR
  // #177) checkout.html dejó de importar ese archivo, así que el puente
  // nunca se volvía a cargar y ningún correo de pedido se disparaba desde
  // el checkout real. Este módulo ya se carga únicamente en checkout.html
  // (ver js/components/cart/sincronizacion-carrito.js), así que alcanza con importarlo acá.
  if (!window.TintinCheckoutEmailBridgeLoading) {
    window.TintinCheckoutEmailBridgeLoading = true;
    import('../pages/checkout/checkout-puente-correo.js?v=tintin-20260716-cloudinary-fix-1').catch(error => {
      console.error('[secure-checkout-order] No se pudo cargar el puente de correo del pedido:', error);
    });
  }

  const REQUEST_KEY = 'tt_spark_checkout_request_id';
  const DEFAULT_STORE_WHATSAPP = '595981299331';
  const CHECKOUT_COOLDOWN_MS = 90 * 1000;
  let submitting = false;

  const text = value => String(value == null ? '' : value).trim();
  const escapeHtml = value => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function appError(code, message, details = {}) {
    const error = new Error(message || code);
    error.code = code;
    error.details = { code, ...details };
    return error;
  }

  function parseMoney(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.round(value) : NaN;
    }
    const parsed = Number(
      String(value == null ? '' : value)
        .replace(/gs\.?/gi, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    );
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
  }

  // Conserva la misma clave de idempotencia durante la carga aunque el
  // navegador bloquee sessionStorage (modo privado o navegador embebido).
  let inMemoryRequestId = null;
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
      if (!inMemoryRequestId) {
        inMemoryRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
      }
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
    document.getElementById('tt-review-cart')?.addEventListener('click', () => window.location.reload());
  }

  function hideError() {
    const box = document.getElementById('error-4');
    if (box) {
      box.classList.remove('show');
      box.textContent = '';
    }
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
          const point = marker.getLatLng();
          window.__TintinCheckoutPoint = {
            lat: Number(point.lat.toFixed(6)),
            lng: Number(point.lng.toFixed(6))
          };
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
      const current = window.__TintinCheckoutMarker?.getLatLng?.();
      if (current) {
        point = {
          lat: Number(current.lat.toFixed(6)),
          lng: Number(current.lng.toFixed(6))
        };
      }
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
    return (Array.isArray(list) ? list : [])
      .map((item, sourceIndex) => {
        if (typeof item === 'string') {
          return {
            name: text(item),
            price: parseMoney(fallback),
            sourceIndex
          };
        }
        if (!item?.name) return null;
        const price = item.price === null
          ? null
          : parseMoney(item.price === undefined ? fallback : item.price);
        return {
          name: text(item.name),
          price: Number.isFinite(price) ? price : null,
          sourceIndex
        };
      })
      .filter(Boolean);
  }

  // deliveryCities/encomiendaCities/deliveryCost/encomiendaCost viven en
  // settings/shippingRates, separado de settings/general (ver
  // sparkShippingRatesPath() en firestore.rules) — settings/general debe
  // quedar liviano para no superar el límite de 1000 expresiones que
  // Firestore evalúa por escritura. Si settings/shippingRates todavía no
  // existe (recién migrado, ver js/admin/admin-app.js), se usan los mismos
  // campos si siguen presentes en settings/general como respaldo.
  function mergeShippingRates(settings, shippingRatesSnap) {
    const rates = shippingRatesSnap?.exists() ? shippingRatesSnap.data() || {} : {};
    return {
      ...settings,
      deliveryCities: Array.isArray(rates.deliveryCities) ? rates.deliveryCities : settings.deliveryCities,
      encomiendaCities: Array.isArray(rates.encomiendaCities) ? rates.encomiendaCities : settings.encomiendaCities,
      deliveryCost: rates.deliveryCost != null ? rates.deliveryCost : settings.deliveryCost,
      encomiendaCost: rates.encomiendaCost != null ? rates.encomiendaCost : settings.encomiendaCost
    };
  }

  // 'agencia' | 'puerta' | '' — lo elige la clienta en el paso de envío y sólo
  // aplica a encomienda. Sin este dato no se sabe si el pedido se despacha a
  // una agencia o se lleva a una puerta, que es justamente lo que hay que
  // coordinar después.
  function encomiendaMode() {
    const puerta = document.getElementById('ck-enc-puerta');
    const agencia = document.getElementById('ck-enc-agencia');
    if (puerta?.classList.contains('is-active')) return 'puerta';
    if (agencia?.classList.contains('is-active')) return 'agencia';
    return '';
  }

  function resolveShipping(settings, selectedCity, location) {
    if (selectedCity === '__retiro__') {
      return {
        method: 'retiro',
        city: 'Retiro coordinado',
        cost: 0,
        pending: false,
        rateIndex: -1,
        mapLocation: null
      };
    }

    const wanted = text(selectedCity).toLocaleLowerCase('es');
    const delivery = normalizeCities(settings.deliveryCities, settings.deliveryCost)
      .find(city => city.name.toLocaleLowerCase('es') === wanted);
    if (delivery) {
      return {
        method: 'delivery',
        city: delivery.name,
        cost: delivery.price,
        pending: delivery.price === null,
        rateIndex: delivery.sourceIndex,
        mapLocation: location
      };
    }

    const encomienda = normalizeCities(settings.encomiendaCities, settings.encomiendaCost)
      .find(city => city.name.toLocaleLowerCase('es') === wanted);
    if (encomienda) {
      const mode = encomiendaMode();
      if (!mode) {
        throw appError('shipping_invalid', 'Elegí si retirás en la agencia o si te lo llevamos a la puerta.');
      }
      return {
        method: 'encomienda',
        // Entrega en puerta necesita el punto exacto igual que el delivery;
        // el retiro en agencia no tiene dirección que guardar.
        encomiendaMode: mode,
        city: encomienda.name,
        // La transportadora cobra la encomienda al recibir. No forma parte
        // del importe cobrado por Tintin ni del total que verá una pasarela.
        cost: 0,
        pending: false,
        rateIndex: encomienda.sourceIndex,
        mapLocation: mode === 'puerta' ? location : null
      };
    }

    throw appError('shipping_invalid', 'La ciudad elegida ya no está disponible.');
  }

  function readPhone() {
    const raw = text(document.getElementById('ck-phone-number')?.value);
    const country = findCountryByCode(document.getElementById('ck-phone-country')?.value);
    if (!country || !isValidPhone(raw, country)) {
      throw appError('phone_invalid', 'Ingresá un teléfono o WhatsApp válido.');
    }
    return normalizePhone(raw, country).value;
  }

  async function buildDraft() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.emailVerified) {
      throw appError('login_required', 'Necesitás iniciar sesión con un correo verificado.');
    }

    const items = getCartLocal();
    if (!items.length) throw appError('empty_cart', 'Tu carrito está vacío.');

    const [settingsSnap, shippingRatesSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'general')),
      getDoc(doc(db, 'settings', 'shippingRates'))
    ]);
    if (!settingsSnap.exists()) {
      throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
    }
    const settings = mergeShippingRates(settingsSnap.data() || {}, shippingRatesSnap);
    const selectedCity = text(document.getElementById('ck-city')?.value);
    const selectedDepartamentoRaw = text(document.getElementById('ck-departamento')?.value);
    const selectedDepartamento = selectedDepartamentoRaw === '__retiro__' ? '' : selectedDepartamentoRaw;
    const shipping = resolveShipping(settings, selectedCity, mapLocation());
    const name = text(document.getElementById('ck-name')?.value);
    const address = text(document.getElementById('ck-address')?.value);
    const paymentMethod = text(document.querySelector('input[name="ck-pay"]:checked')?.value);

    if (name.length < 2) throw appError('name_required', 'Ingresá tu nombre completo.');
    if (!['efectivo', 'transferencia'].includes(paymentMethod)) {
      throw appError('payment_required', 'Seleccioná un método de pago disponible.');
    }
    if (shipping.method === 'delivery' && (!shipping.mapLocation || !shipping.mapLocation.name)) {
      throw appError('map_required', 'Marcá y nombrá tu ubicación en el mapa.');
    }
    if (shipping.method === 'encomienda' && shipping.encomiendaMode === 'puerta') {
      if (address.length < 5) {
        throw appError('address_required', 'Ingresá la dirección para la entrega en puerta.');
      }
      if (!shipping.mapLocation || !shipping.mapLocation.name) {
        throw appError('map_required', 'Marcá y nombrá la ubicación para la entrega en puerta.');
      }
    }

    const localSubtotal = cartTotal(items);
    return composeCheckoutDraft({
      requestId: requestId(),
      items,
      name,
      phone: readPhone(),
      contactEmail: text(document.getElementById('ck-email')?.value).toLowerCase(),
      notes: text(document.getElementById('ck-notes')?.value).slice(0, 1000),
      selectedCity,
      departamento: selectedDepartamento,
      address,
      referencia: text(document.getElementById('ck-referencia')?.value),
      shipping,
      paymentMethod,
      subtotal: localSubtotal
    });
  }

  function authoritativeCartFromQuote(quote) {
    const currentById = new Map(getCartLocal().map(item => [String(item.id), item]));
    return (quote.items || []).map(item => ({
      ...(currentById.get(String(item.id)) || {}),
      id: item.id,
      name: item.name,
      cat: item.cat || '',
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      variant: item.variant || '',
      imageUrl: item.imageUrl || '',
      imgUrl: item.imageUrl || ''
    }));
  }

  function renderQuote(quote) {
    setCartLocal(authoritativeCartFromQuote(quote));
    // Reemplaza solo el contenedor de ítems/totales (#ck-summary-quote,
    // definido en checkout.html), no todo #ck-confirm-summary — de lo
    // contrario se perdían nombre/teléfono/dirección/notas del resumen
    // justo cuando se le pide a la clienta que lo revise de nuevo.
    const target = document.getElementById('ck-summary-quote') || document.getElementById('ck-confirm-summary');
    if (!target) return;
    target.innerHTML = `
      <div class="ck-summary-items">${(quote.items || []).map(item => `
        <div class="ck-summary-item">
          <span class="ck-summary-item-name">${item.qty}x ${escapeHtml(item.name)}</span>
          <span style="font-weight:700">${formatPrice(item.price * item.qty)}</span>
        </div>`).join('')}</div>
      <div class="ck-summary-total" style="margin-top:16px"><span>Subtotal</span><span class="ck-summary-total-val">${formatPrice(quote.subtotal)}</span></div>
      <div class="ck-summary-total"><span>Costo de envío</span><span class="ck-summary-total-val">${quote.shippingPending ? 'A confirmar' : formatPrice(quote.shippingCost || 0)}</span></div>
      <div class="ck-summary-total" style="font-size:18px"><span>TOTAL${quote.shippingPending ? ' (+ envío)' : ''}</span><span class="ck-summary-total-val">${formatPrice(quote.total)}</span></div>`;
  }


  async function reserveCheckoutGuard(draft) {
    const user = auth.currentUser;
    const uid = user.uid;
    const email = text(user.email).toLowerCase();
    const orderId = `${uid}_${draft.requestId}`;
    const guardRef = doc(db, 'checkoutGuards', uid);

    return runTransaction(db, async transaction => {
      const guardSnap = await transaction.get(guardRef);
      const guardData = guardSnap.exists() ? guardSnap.data() || {} : {};
      const lastCheckoutAt = guardData.lastCheckoutAt;
      const lastCheckoutMs = typeof lastCheckoutAt?.toMillis === 'function'
        ? lastCheckoutAt.toMillis()
        : Number(new Date(lastCheckoutAt || 0));
      const sameOrder = text(guardData.lastCheckoutOrderId) === orderId;

      if (
        !sameOrder &&
        email !== SUPER_ADMIN_EMAIL &&
        Number.isFinite(lastCheckoutMs) &&
        Date.now() - lastCheckoutMs < CHECKOUT_COOLDOWN_MS
      ) {
        const remaining = Math.max(1, Math.ceil((CHECKOUT_COOLDOWN_MS - (Date.now() - lastCheckoutMs)) / 1000));
        throw appError('checkout_cooldown', 'Esperá un momento antes de crear otro pedido.', { remaining });
      }

      transaction.set(guardRef, {
        userId: uid,
        lastCheckoutAt: serverTimestamp(),
        lastCheckoutOrderId: orderId,
        updatedAt: serverTimestamp()
      }, { merge: true });

      return { orderId };
    }, { maxAttempts: 2 });
  }

  // El pedido se crea server-side (Apps Script, apps-script/CrearPedido.gs)
  // en vez de con una transacción de Firestore desde el navegador: ese
  // proceso corre con la identidad de su dueño (ScriptApp.getOAuthToken()),
  // así que no pasa por el límite de 1000 expresiones de firestore.rules ni
  // por ningún tope de productos distintos. El servidor vuelve a leer
  // precio/stock real de cada producto, valida tienda/cuenta/envío/turno de
  // compra (checkoutGuards) y crea el pedido ya con el stock descontado en
  // una sola transacción — no hay estado "pendiente" intermedio que limpiar
  // en un reintento: si el requestId ya generó un pedido, el servidor
  // devuelve ese mismo pedido (created: false) en vez de duplicarlo.
  async function createOrderOnServer(draft) {
    const response = await createOrderViaServer(draft);
    if (!response || typeof response !== 'object') {
      throw appError('server_error', 'No pudimos confirmar el pedido. Intentá nuevamente.');
    }
    if (response.ok !== true) {
      throw appError(response.error || 'server_error', undefined, {
        quote: response.quote,
        productId: response.productId,
        available: response.available,
        requested: response.requested
      });
    }
    return { ...(response.order || {}), orderId: response.orderId };
  }

  const SHIPPING_LABELS = {
    retiro: 'Retiro en tienda',
    delivery: 'Delivery a domicilio',
    encomienda: 'Encomienda al interior',
  };
  const ENCOMIENDA_LABELS = {
    agencia: 'retiro en agencia',
    puerta: 'entrega en puerta',
  };
  const PAYMENT_LABELS = {
    efectivo: 'Efectivo contra entrega',
    transferencia: 'Transferencia bancaria',
    tarjeta: 'Tarjeta',
  };

  function shippingSummary(draft) {
    const method = text(draft?.shippingMethod);
    const base = SHIPPING_LABELS[method] || method || 'A coordinar';
    const mode = ENCOMIENDA_LABELS[text(draft?.encomiendaMode)];
    return mode ? `${base} — ${mode}` : base;
  }

  /**
   * Mensaje de WhatsApp para CONSULTAR por un pedido que ya se hizo.
   *
   * Los pedidos se hacen en la página, no por WhatsApp: cuando este botón
   * aparece, el pedido ya está registrado con su número. El mensaje lleva el
   * detalle para que no haya que reescribirlo al preguntar algo, y arranca
   * diciendo que es una consulta — no un pedido nuevo, para que nadie del
   * otro lado lo cargue dos veces.
   */
  function buildWhatsAppMessage(result, draft) {
    const itemLines = (result.items || [])
      .map(item => `• ${item.qty}x ${item.name} — ${formatPrice(item.price * item.qty)}`)
      .join('\n');
    const shippingText = result.shippingPending
      ? 'A confirmar'
      : formatPrice(result.shippingCost || 0);

    const lines = [
      `Hola, consulto por mi pedido *#${result.shortId}* (ya confirmado en la web).`,
      '',
      itemLines,
      '',
      `💰 Subtotal: ${formatPrice(result.subtotal || 0)}`,
      `🚚 Envío: ${shippingText}`,
      `💰 Total: ${formatPrice(result.total || 0)}${result.shippingPending ? ' + envío' : ''}`,
      '',
      `📦 Entrega: ${shippingSummary(draft)}`,
    ];

    if (draft?.shippingMethod === 'retiro') {
      lines.push('📍 Solicito la ubicación exacta y el horario disponible para retirar.');
    }

    const city = text(draft?.selectedCity);
    if (city && city !== '__retiro__') lines.push(`📍 Ciudad: ${city}`);

    const address = text(draft?.address);
    if (address) lines.push(`🏠 Dirección: ${address}`);

    const locationName = text(draft?.mapLocation?.name);
    if (locationName) lines.push(`🗺️ Ubicación: ${locationName}`);

    const payment = text(draft?.paymentMethod);
    if (payment) lines.push(`💳 Pago: ${PAYMENT_LABELS[payment] || payment}`);

    const name = text(draft?.name);
    if (name) lines.push('', `👤 ${name}`);
    const phone = text(draft?.phone);
    if (phone) lines.push(`📱 ${phone}`);

    return lines.join('\n');
  }

  function success(result, draft) {
    window._lastOrderId = result.shortId;
    document.getElementById('ck-review-head')?.style.setProperty('display', 'none');
    document.getElementById('ck-success-head')?.style.setProperty('display', 'block');
    document.getElementById('ck-confirm-btn')?.style.setProperty('display', 'none');
    document.getElementById('ck-post-confirm')?.style.setProperty('display', 'block');
    const number = document.getElementById('ck-order-num');
    if (number) {
      number.style.display = 'block';
      number.textContent = `N° de pedido: ${result.shortId}`;
    }
    const whatsapp = document.getElementById('ck-wa-support');
    if (whatsapp) {
      const phone = text(result.storeWhatsapp || DEFAULT_STORE_WHATSAPP).replace(/\D/g, '');
      whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(result, draft))}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function message(error) {
    const code = error?.details?.code || error?.code || error?.message;
    const messages = {
      empty_cart: 'Tu carrito está vacío.',
      name_required: 'Ingresá tu nombre completo.',
      phone_invalid: 'Ingresá un teléfono o WhatsApp válido.',
      payment_required: 'Seleccioná un método de pago.',
      map_required: 'Marcá y nombrá tu ubicación en el mapa.',
      address_required: 'Ingresá la dirección para la encomienda.',
      shipping_invalid: 'La ciudad elegida ya no está disponible.',
      settings_missing: 'No pudimos comprobar la configuración de la tienda.',
      profile_missing: 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.',
      checkout_cooldown: error?.details?.remaining
        ? `Esperá ${error.details.remaining} segundos antes de crear otro pedido.`
        : 'Esperá un momento antes de crear otro pedido.',
      login_required: 'Necesitás iniciar sesión con un correo verificado.',
      blocked_account: 'Esta cuenta está bloqueada.',
      store_closed: 'La tienda está temporalmente cerrada.',
      payment_unavailable: 'Ese método de pago ya no está disponible.',
      too_many_products: error?.message || 'Tu pedido tiene demasiados productos distintos. Escribinos por WhatsApp para coordinarlo.',
      invalid_cart: error?.message,
      invalid_price: 'No pudimos comprobar el precio de uno de los productos.',
      quote_changed: 'Cambió un precio o el costo de envío. Confirmá de nuevo para continuar con los valores actuales.',
      order_state_invalid: 'Este pedido ya no puede reanudarse. Volvé a intentar desde el carrito.',
      checkout_guard_missing: 'No pudimos confirmar tu turno de compra. Volvé a intentar.',
      checkout_guard_expired: 'Pasó demasiado tiempo desde que confirmaste. Volvé a intentar.',
      missing_id_token: 'Necesitás iniciar sesión con un correo verificado.',
      invalid_id_token: 'Tu sesión expiró. Volvé a ingresar e intentá de nuevo.',
      token_verify_failed: 'No pudimos verificar tu sesión. Volvé a intentar.',
      email_not_verified: 'Necesitás verificar tu correo antes de comprar.',
      server_error: 'No pudimos confirmar el pedido. Intentá nuevamente.',
      transaction_begin_failed: 'No pudimos conectar con el servidor. Intentá nuevamente.',
      batch_get_failed: 'No pudimos conectar con el servidor. Intentá nuevamente.',
      commit_failed: 'No pudimos confirmar el pedido. Intentá nuevamente.',
      create_order_failed: 'No pudimos confirmar el pedido. Intentá nuevamente.'
    };
    if (messages[code]) return messages[code];
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return 'No pudimos registrar el pedido por un problema de permisos. Volvé a intentar; si continúa, escribinos por WhatsApp.';
    }
    if (code === 'unavailable' || code === 'firestore/unavailable') {
      return 'No pudimos conectar con Firebase. Revisá tu internet y volvé a intentar.';
    }
    return 'No pudimos confirmar el pedido. Intentá nuevamente.';
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
      inMemoryRequestId = null;
      success(result, draft);
    } catch (error) {
      console.error('[spark-checkout]', error);
      const code = error?.details?.code || error?.code;
      if (code === 'quote_changed' && error.details?.quote) {
        renderQuote(error.details.quote);
        showError('Cambió un precio o el costo de envío. Revisá el resumen actualizado y confirmá nuevamente.');
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido actualizado';
      } else if (code === 'insufficient_stock') {
        const productId = String(error.details?.productId || '');
        const available = Number(error.details?.available || 0);
        setCartLocal(
          getCartLocal()
            .map(item => String(item.id) === productId
              ? (available > 0 ? { ...item, qty: Math.min(Number(item.qty || 1), available) } : null)
              : item)
            .filter(Boolean)
        );
        button.disabled = true;
        button.textContent = 'Revisá el carrito para continuar';
        showError(
          available > 0
            ? `Cambió el stock. Dejamos la cantidad disponible: ${available}.`
            : 'Uno de los productos se agotó y lo quitamos del carrito.',
          true
        );
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
