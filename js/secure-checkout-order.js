import { auth, db } from './firebase.js?v=tintin-20260716-cloudinary-fix-1';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getCartLocal,
  setCartLocal,
  clearCart,
  cartTotal,
  formatPrice
} from './cart-sync.js?v=tintin-20260716-cloudinary-fix-1';
import {
  findCountryByCode,
  normalizePhone,
  isValidPhone
} from './phone-utils.js?v=tintin-20260716-cloudinary-fix-1';

if (!window.TintinSecureCheckoutOrderBooted) {
  window.TintinSecureCheckoutOrderBooted = true;

  const REQUEST_KEY = 'tt_spark_checkout_request_id';
  const MAX_DISTINCT_PRODUCTS = 4;
  const SUPER_ADMIN_EMAIL = 'tintinaccs@gmail.com';
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

  function parseStock(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
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
      return `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
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

  function resolveShipping(settings, selectedCity, location) {
    if (selectedCity === '__retiro__') {
      return {
        method: 'retiro',
        city: 'San Lorenzo (retiro)',
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
      return {
        method: 'encomienda',
        city: encomienda.name,
        cost: encomienda.price,
        pending: encomienda.price === null,
        rateIndex: encomienda.sourceIndex,
        mapLocation: null
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

  function aggregateCart(items) {
    const byProduct = new Map();
    for (const item of items) {
      const id = text(item?.id);
      const qty = Number(item?.qty || 1);
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) {
        throw appError('invalid_cart', 'Encontramos una cantidad no válida en el carrito.');
      }
      const existing = byProduct.get(id);
      if (existing) {
        existing.qty += qty;
        const variant = text(item.variant);
        if (variant && !existing.variants.includes(variant)) existing.variants.push(variant);
      } else {
        byProduct.set(id, {
          id,
          qty,
          variants: text(item.variant) ? [text(item.variant)] : []
        });
      }
    }

    const result = [...byProduct.values()];
    if (result.length > MAX_DISTINCT_PRODUCTS) {
      throw appError(
        'too_many_products',
        `Para proteger el stock en el plan gratuito, cada pedido puede incluir hasta ${MAX_DISTINCT_PRODUCTS} productos diferentes. Dividí tu compra en dos pedidos.`
      );
    }
    if (result.some(item => item.qty > 99)) {
      throw appError('invalid_cart', 'La cantidad de uno de los productos es demasiado alta.');
    }
    return result;
  }

  async function buildDraft() {
    const user = auth.currentUser;
    if (!user || user.isAnonymous || !user.emailVerified) {
      throw appError('login_required', 'Necesitás iniciar sesión con un correo verificado.');
    }

    const items = getCartLocal();
    if (!items.length) throw appError('empty_cart', 'Tu carrito está vacío.');

    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    if (!settingsSnap.exists()) {
      throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
    }
    const settings = settingsSnap.data() || {};
    const selectedCity = text(document.getElementById('ck-city')?.value);
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
    if (shipping.method === 'encomienda' && address.length < 5) {
      throw appError('address_required', 'Ingresá la dirección para la encomienda.');
    }

    const localSubtotal = cartTotal(items);
    const localShippingCost = shipping.cost === null ? 0 : shipping.cost;
    return {
      requestId: requestId(),
      cartLines: aggregateCart(items),
      name,
      phone: readPhone(),
      contactEmail: text(document.getElementById('ck-email')?.value).toLowerCase(),
      notes: text(document.getElementById('ck-notes')?.value).slice(0, 1000),
      selectedCity,
      address,
      referencia: text(document.getElementById('ck-referencia')?.value),
      mapLocation: shipping.mapLocation,
      paymentMethod,
      expectedSubtotal: Math.round(localSubtotal),
      expectedShippingCost: Math.round(localShippingCost),
      expectedShippingPending: shipping.pending,
      expectedTotal: Math.round(localSubtotal + localShippingCost)
    };
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
    const target = document.getElementById('ck-confirm-summary');
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

  async function createOrderWithSparkTransaction(draft) {
    const user = auth.currentUser;
    const uid = user.uid;
    const email = text(user.email).toLowerCase();
    const orderId = `${uid}_${draft.requestId}`;
    const orderRef = doc(db, 'orders', orderId);
    const settingsRef = doc(db, 'settings', 'general');
    const userRef = doc(db, 'users', uid);
    const productRefs = draft.cartLines.map(line => doc(db, 'products', line.id));

    return runTransaction(db, async transaction => {
      const existing = await transaction.get(orderRef);
      if (existing.exists()) {
        const data = existing.data() || {};
        return { ...data, orderId, created: false, success: true };
      }

      const settingsSnap = await transaction.get(settingsRef);
      const userSnap = await transaction.get(userRef);
      const productSnaps = [];
      for (const productRef of productRefs) {
        productSnaps.push(await transaction.get(productRef));
      }

      if (!settingsSnap.exists()) {
        throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
      }
      const settings = settingsSnap.data() || {};
      if (!userSnap.exists()) {
        throw appError('profile_missing', 'No pudimos comprobar tu perfil. Cerrá sesión y volvé a ingresar.');
      }
      const userData = userSnap.data() || {};
      if (email !== SUPER_ADMIN_EMAIL && settings.storeOpen !== true) {
        throw appError('store_closed', 'La tienda está temporalmente cerrada.');
      }
      if (email !== SUPER_ADMIN_EMAIL && userData.blocked === true) {
        throw appError('blocked_account', 'Esta cuenta está bloqueada y no puede realizar pedidos.');
      }

      const paymentMethods = settings.paymentMethods || {};
      if (paymentMethods[draft.paymentMethod] === false) {
        throw appError('payment_unavailable', 'Ese método de pago ya no está disponible.');
      }

      const shipping = resolveShipping(settings, draft.selectedCity, draft.mapLocation);
      const resolvedItems = [];
      let subtotal = 0;

      productSnaps.forEach((snapshot, index) => {
        const requested = draft.cartLines[index];
        if (!snapshot.exists()) {
          throw appError('product_not_found', 'Uno de los productos ya no está disponible.', { productId: requested.id });
        }
        const product = snapshot.data() || {};
        if (product.active === false) {
          throw appError('product_inactive', 'Uno de los productos fue desactivado.', { productId: requested.id });
        }
        const price = parseMoney(product.price);
        if (!Number.isFinite(price) || price < 0) {
          throw appError('invalid_price', 'No pudimos comprobar el precio de uno de los productos.');
        }
        const stock = parseStock(product.stock);
        if (stock !== null && requested.qty > stock) {
          throw appError('insufficient_stock', 'Cambió el stock de uno de los productos.', {
            productId: requested.id,
            available: stock,
            requested: requested.qty
          });
        }

        const item = {
          id: requested.id,
          name: text(product.name || product.title || product.Title || 'Producto').slice(0, 180),
          cat: text(product.category || product.collectionSlug || product.collection || product.cat || product.Type || product.type).slice(0, 120),
          price,
          qty: requested.qty,
          variant: requested.variants.join(' / ').slice(0, 120),
          imageUrl: text(product.imageUrl || product.image || product.img).slice(0, 900)
        };
        resolvedItems.push(item);
        subtotal += price * requested.qty;
      });

      const shippingCost = shipping.cost === null ? 0 : shipping.cost;
      const total = subtotal + shippingCost;
      const quote = {
        items: resolvedItems,
        subtotal,
        shippingCost,
        shippingPending: shipping.pending,
        total
      };

      if (
        draft.expectedSubtotal !== subtotal ||
        draft.expectedShippingCost !== shippingCost ||
        draft.expectedShippingPending !== shipping.pending ||
        draft.expectedTotal !== total
      ) {
        throw appError(
          'quote_changed',
          'Cambió un precio o el costo de envío. Revisá el resumen actualizado.',
          { quote }
        );
      }

      const shortId = draft.requestId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      const orderData = {
        requestId: draft.requestId,
        source: 'spark-checkout-v1',
        shortId,
        userId: uid,
        userEmail: email,
        contactEmail: draft.contactEmail || email,
        userName: draft.name,
        userPhone: draft.phone,
        items: resolvedItems,
        subtotal,
        shippingCost,
        shippingPending: shipping.pending,
        total,
        storeWhatsapp: text(settings.whatsappNumber || settings.whatsapp || DEFAULT_STORE_WHATSAPP).replace(/\D/g, ''),
        storeInstagram: text(settings.instagram).slice(0, 120),
        shipping: {
          method: shipping.method,
          city: shipping.city,
          rateIndex: shipping.rateIndex,
          address: draft.address,
          referencia: draft.referencia,
          zone: shipping.method === 'encomienda' ? 'interior' : 'central',
          mapLocation: shipping.method === 'delivery' ? shipping.mapLocation : null
        },
        payment: {
          method: draft.paymentMethod,
          status: 'pendiente'
        },
        paymentStatus: 'pendiente',
        status: 'pendiente',
        notes: draft.notes,
        notificationStatus: 'pending',
        inventoryState: 'reserved',
        inventoryRevision: 1,
        inventoryUpdatedAt: serverTimestamp(),
        inventoryUpdatedBy: email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      productSnaps.forEach((snapshot, index) => {
        const product = snapshot.data() || {};
        const stock = parseStock(product.stock);
        if (stock !== null) {
          transaction.update(productRefs[index], {
            stock: stock - draft.cartLines[index].qty,
            lastStockOrderId: orderId,
            updatedAt: serverTimestamp()
          });
        }
      });
      transaction.set(orderRef, orderData);

      return {
        ...orderData,
        orderId,
        success: true,
        created: true,
        items: resolvedItems,
        shipping: orderData.shipping,
        payment: orderData.payment
      };
    }, { maxAttempts: 2 });
  }

  function buildWhatsAppMessage(result) {
    const itemLines = (result.items || [])
      .map(item => `• ${item.qty}x ${item.name} — ${formatPrice(item.price * item.qty)}`)
      .join('\n');
    const shippingText = result.shippingPending
      ? 'A confirmar'
      : formatPrice(result.shippingCost || 0);
    return `🛍️ *PEDIDO TINTIN #${result.shortId}*\n\n${itemLines}\n\n💰 Subtotal: ${formatPrice(result.subtotal || 0)}\n🚚 Envío: ${shippingText}\n💰 Total: ${formatPrice(result.total || 0)}${result.shippingPending ? ' + envío' : ''}`;
  }

  function success(result) {
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
      whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage(result))}`;
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
      too_many_products: error?.message,
      invalid_cart: error?.message,
      invalid_price: 'No pudimos comprobar el precio de uno de los productos.'
    };
    if (messages[code]) return messages[code];
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      return 'Firebase rechazó el pedido. Publicá las reglas gratuitas del Paso 2 y volvé a intentar.';
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
      const result = await createOrderWithSparkTransaction(draft);
      await clearCart();
      try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
      success(result);
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
