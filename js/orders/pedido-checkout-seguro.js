import { isValidCustomerName } from '../pages/profile/configuracion-inicial-perfil.mjs?v=tintin-20261010-registration-name-2';
import { shippingDepartment } from '../components/location/departamento-ciudad.mjs?v=tintin-20261008-shipping-department-1';
import { hasForwardValidation, replayValidatedForward } from '../pages/checkout/validacion-avance.js?v=tintin-20261007-checkout-guards-1';
import { db } from '../core/firebase/firebase.js?v=tintin-20260924-auth-popup-resolver-1-launch-20260926-1';
import { SUPER_ADMIN as SUPER_ADMIN_EMAIL } from '../core/auth/roles.js?v=tintin-20260916-final-polish-2-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1';
import { AUTH_STATES, getSessionUser, waitForSession, subscribeAuthState } from '../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
function requireCartRuntime() {
  const runtime = window.TintinCartRuntime;
  if (!runtime) {
    throw new Error('[secure-checkout-order] El runtime canónico del carrito no está disponible.');
  }
  return runtime;
}

const getCartLocal = (...args) => requireCartRuntime().getCartLocal(...args);
const setCartLocal = (...args) => requireCartRuntime().setCartLocal(...args);
const clearCart = (...args) => requireCartRuntime().clearCart(...args);
const cartTotal = (...args) => requireCartRuntime().cartTotal(...args);
const formatPrice = (...args) => requireCartRuntime().formatPrice(...args);
const awaitCartReady = (...args) => requireCartRuntime().awaitCartReady(...args);
import {
  findCountryByCode,
  normalizePhone,
  isValidPhone
} from '../components/forms/utilidades-telefono.js?v=tintin-20261008-producto-superficies-1';
import {
  isValidCi,
  normalizeCi,
  isValidRuc,
  normalizeRuc,
  isValidRazonSocial,
  isValidTaxpayerType
} from '../components/forms/validacion-documentos-py.js?v=tintin-20260822-facturacion-1-master-20261007-1';
import { createOrderViaServer } from '../create-order-public-client.js?v=tintin-20260918-global-session-restore-1-auth-persistence-20260919-1-auth-popup-resolver-1-launch-20260926-1';
import { composeCheckoutDraft } from './politica-checkout.js?v=tintin-20260822-checkout-hardening-2-cupones-1-master-20261007-1';

if (!window.TintinSecureCheckoutOrderBooted) {
  window.TintinSecureCheckoutOrderBooted = true;

  if (!window.TintinCheckoutEmailBridgeLoading) {
    window.TintinCheckoutEmailBridgeLoading = true;
    import('../pages/checkout/checkout-puente-correo.js?v=tintin-20261007-email-app-check-1').catch(error => {
      console.error('[secure-checkout-order] No se pudo cargar el puente de correo del pedido:', error);
    });
  }

  const REQUEST_KEY = 'tt_spark_checkout_request_id';
  const DEFAULT_STORE_WHATSAPP = '595981299331';
  const CHECKOUT_COOLDOWN_MS = 90 * 1000;
  const GUEST_CART_KEY = 'tt_cart_guest';
  const GUEST_ACTIVITY_KEY = 'tt_cart_guest_activity_v1';
  const CHECKOUT_DEFAULTS_FIELD = 'checkoutDefaults';
  let submitting = false;
  let orderCompleted = false;
  let cartGuardTimer = 0;
  let lastProfilePrefillUid = '';
  let pendingPaypal = null;

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
    box.setAttribute('role', 'alert');
    box.tabIndex = -1;
    box.focus();
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    document.getElementById('tt-review-cart')?.addEventListener('click', () => window.location.reload());
  }

  function hideError() {
    const box = document.getElementById('error-4');
    if (box) {
      box.classList.remove('show');
      box.textContent = '';
    }
  }

  function readGuestCartForRecovery() {
    try {
      const parsed = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // El runtime del carrito espera App Check antes de abrir el listener remoto.
  // Si App Check queda bloqueado por el navegador, awaitCartReady() resuelve en
  // modo offline. En ese caso, una compra agregada como invitada justo antes de
  // que Firebase Auth resolviera podía quedar todavía en tt_cart_guest mientras
  // el scope activo ya había cambiado al usuario, haciendo que checkout viera
  // un carrito vacío. Sólo recuperamos ese carrito DESPUÉS de awaitCartReady():
  // si la sincronización remota funcionó, el runtime ya lo migró por sí mismo.
  async function readyCartItems() {
    await awaitCartReady();
    let items = getCartLocal();
    const snapshot = await waitForSession();
    if (snapshot.status === AUTH_STATES.UNKNOWN) return items;
    const user = snapshot.user;
    if (items.length || !user || user.isAnonymous) return items;

    const guestItems = readGuestCartForRecovery();
    if (!guestItems.length) return items;

    items = setCartLocal(guestItems);
    try {
      localStorage.removeItem(GUEST_CART_KEY);
      localStorage.removeItem(GUEST_ACTIVITY_KEY);
    } catch {}
    console.info('[secure-checkout-order] Carrito temporal recuperado para la cuenta activa.');
    return items;
  }

  function activeCheckoutStep() {
    return Array.from(document.querySelectorAll('.ck-panel'))
      .findIndex(panel => panel.classList.contains('active'));
  }

  function setConfirmDisabledByCart(disabled) {
    const button = document.getElementById('ck-confirm-btn');
    if (!button || button.style.display === 'none') return;
    if (disabled) {
      button.dataset.ttCartGuardDisabled = '1';
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      return;
    }
    if (button.dataset.ttCartGuardDisabled === '1' && !submitting) {
      delete button.dataset.ttCartGuardDisabled;
      button.disabled = false;
      button.setAttribute('aria-disabled', 'false');
    }
  }

  function forceBackToCart(message = 'Tu carrito está vacío. Agregá productos antes de continuar.') {
    if (orderCompleted) return;
    document.querySelectorAll('.ck-panel').forEach((panel, index) => {
      panel.classList.toggle('active', index === 0);
    });
    document.querySelectorAll('.ck-step').forEach((step, index) => {
      step.classList.remove('active', 'done');
      if (index === 0) step.classList.add('active');
    });
    const summary = document.getElementById('ck-confirm-summary');
    if (summary) summary.innerHTML = '';
    const error = document.getElementById('error-0');
    if (error) {
      error.textContent = message;
      error.classList.add('show');
    }
    setConfirmDisabledByCart(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function ensureCartAvailable({ forceBack = true } = {}) {
    const items = await readyCartItems();
    if (items.length) {
      setConfirmDisabledByCart(false);
      return items;
    }
    setConfirmDisabledByCart(true);
    if (forceBack) forceBackToCart();
    return [];
  }

  async function prefillCheckoutDefaults(user) {
    if (!user || user.isAnonymous || !user.uid || lastProfilePrefillUid === user.uid) return;
    lastProfilePrefillUid = user.uid;
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));
      if (getSessionUser()?.uid !== user.uid || !snapshot.exists()) return;
      const profile = snapshot.data() || {};
      const defaults = profile[CHECKOUT_DEFAULTS_FIELD] || {};
      const invoice = defaults.invoice || {};

      const ci = text(defaults.ci);
      const ciInput = document.getElementById('ck-ci');
      if (ciInput && !text(ciInput.value) && isValidCi(ci)) {
        ciInput.value = normalizeCi(ci);
      }

      const razonSocial = text(invoice.razonSocial);
      const razonInput = document.getElementById('ck-razon-social');
      if (razonInput && !text(razonInput.value) && isValidRazonSocial(razonSocial)) {
        razonInput.value = razonSocial;
      }

      const ruc = text(invoice.ruc);
      const rucInput = document.getElementById('ck-ruc');
      if (rucInput && !text(rucInput.value) && isValidRuc(ruc)) {
        rucInput.value = normalizeRuc(ruc);
      }
    } catch (error) {
      lastProfilePrefillUid = '';
      console.warn('[secure-checkout-order] No se pudieron precargar CI/facturación:', error);
    }
  }

  async function persistCheckoutDefaults(draft) {
    const user = getSessionUser();
    if (!user || user.isAnonymous || !user.uid) return;
    const userRef = doc(db, 'users', user.uid);
    let previous = {};
    try {
      const snapshot = await getDoc(userRef);
      previous = snapshot.exists() ? (snapshot.data()?.[CHECKOUT_DEFAULTS_FIELD] || {}) : {};
    } catch {}

    const previousInvoice = previous.invoice || {};
    const draftCi = text(draft?.ci);
    const draftRazon = text(draft?.razonSocial);
    const draftRuc = text(draft?.ruc);
    const previousCi = text(previous.ci);
    const previousRazon = text(previousInvoice.razonSocial);
    const previousRuc = text(previousInvoice.ruc);

    const ci = isValidCi(draftCi)
      ? normalizeCi(draftCi)
      : (isValidCi(previousCi) ? normalizeCi(previousCi) : '');
    const razonSocial = draft?.wantsInvoice && isValidRazonSocial(draftRazon)
      ? draftRazon
      : (isValidRazonSocial(previousRazon) ? previousRazon : '');
    const ruc = draft?.wantsInvoice && isValidRuc(draftRuc)
      ? normalizeRuc(draftRuc)
      : (isValidRuc(previousRuc) ? normalizeRuc(previousRuc) : '');

    await setDoc(userRef, {
      [CHECKOUT_DEFAULTS_FIELD]: {
        ci,
        invoice: { razonSocial, ruc },
        updatedAt: serverTimestamp()
      }
    }, { merge: true });
  }

  // Antes de cualquier avance esperamos el scope real del carrito. Así el
  // botón no puede usar el carrito de invitada durante unos milisegundos y
  // luego continuar con el carrito de la cuenta vacío.
  window.addEventListener('click', event => {
    const button = event.target?.closest?.(
      '#btn-step1-next,#btn-step2-next,#btn-step3-next,#btn-step4-next'
    );
    if (!button || orderCompleted || hasForwardValidation(event, button, 'cart')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    Promise.resolve().then(async () => {
      const items = await ensureCartAvailable();
      if (!items.length) return;
      replayValidatedForward(button, event, 'cart');
    }).catch(error => {
      console.error('[secure-checkout-order] No se pudo validar el carrito antes de avanzar:', error);
      forceBackToCart('No pudimos cargar tu carrito. Recargá la página e intentá de nuevo.');
    });
  }, true);

  // Si el carrito cambia mientras la clienta ya está en Envío/Datos/Pago o
  // Confirmación y queda realmente vacío, no puede permanecer en un resumen
  // de Gs. 0 ni conservar Confirmar pedido habilitado.
  window.addEventListener('tt_cart_updated', () => {
    if (orderCompleted) return;
    window.clearTimeout(cartGuardTimer);
    cartGuardTimer = window.setTimeout(async () => {
      try {
        const items = await readyCartItems();
        if (!items.length && activeCheckoutStep() > 0) {
          forceBackToCart();
        } else {
          setConfirmDisabledByCart(!items.length);
        }
      } catch (error) {
        console.warn('[secure-checkout-order] No se pudo reevaluar el carrito:', error);
      }
    }, 0);
  });

  subscribeAuthState(user => {
    lastProfilePrefillUid = '';
    if (user && !user.isAnonymous) prefillCheckoutDefaults(user);
  });

  // Fuerza un render nuevo cuando el runtime ya resolvió cuál es el carrito
  // real de la cuenta. checkout.html ya escucha tt_cart_updated y redibuja.
  readyCartItems()
    .then(() => window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('tt_cart_updated', {
        detail: { source: 'secure-checkout-ready' }
      }));
    }, 0))
    .catch(error => console.warn('[secure-checkout-order] Carrito inicial no disponible:', error));

  function mapLocation() {
    let point = window.__TintinCheckoutPoint || null;

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
            departamento: shippingDepartment(item),
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
          departamento: shippingDepartment(item.name, text(item.departamento)),
          sourceIndex
        };
      })
      .filter(Boolean);
  }

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

  function encomiendaMode() {
    const puerta = document.getElementById('ck-enc-puerta');
    const agencia = document.getElementById('ck-enc-agencia');
    if (puerta?.classList.contains('is-active')) return 'puerta';
    if (agencia?.classList.contains('is-active')) return 'agencia';
    return '';
  }

  function resolveShipping(settings, selectedCity, selectedDepartment, requestedMethod, location) {
    const requested = text(requestedMethod);
    if (selectedCity === '__retiro__') {
      if (requested && requested !== 'retiro') {
        throw appError('shipping_changed', 'El método de entrega cambió. Volvé a elegir cómo recibir tu pedido.');
      }
      return {
        method: 'retiro',
        city: 'Retiro coordinado',
        departamento: 'Central',
        cost: 0,
        pending: false,
        rateIndex: -1,
        mapLocation: null
      };
    }

    if (!['delivery', 'encomienda'].includes(requested)) {
      throw appError('shipping_invalid', 'Volvé a elegir tu ciudad y método de entrega.');
    }

    const wanted = text(selectedCity).toLocaleLowerCase('es');
    const wantedDepartment = text(selectedDepartment).toLocaleLowerCase('es');
    const matches = city =>
      city.name.toLocaleLowerCase('es') === wanted &&
      (!wantedDepartment || city.departamento.toLocaleLowerCase('es') === wantedDepartment);

    if (requested === 'delivery') {
      const delivery = normalizeCities(settings.deliveryCities, settings.deliveryCost).find(matches);
      if (!delivery) {
        throw appError('shipping_invalid', 'La ciudad elegida ya no está disponible para delivery.');
      }
      return {
        method: 'delivery',
        city: delivery.name,
        departamento: delivery.departamento,
        cost: delivery.price,
        pending: delivery.price === null,
        rateIndex: delivery.sourceIndex,
        mapLocation: location
      };
    }

    const encomienda = normalizeCities(settings.encomiendaCities, settings.encomiendaCost).find(matches);
    if (!encomienda) {
      throw appError('shipping_invalid', 'La ciudad elegida ya no está disponible para encomienda.');
    }
    const mode = encomiendaMode();
    if (!mode) {
      throw appError('shipping_invalid', 'Elegí si retirás en la agencia o si te lo llevamos a la puerta.');
    }
    return {
      method: 'encomienda',
      encomiendaMode: mode,
      city: encomienda.name,
      departamento: encomienda.departamento,
      cost: 0,
      pending: false,
      rateIndex: encomienda.sourceIndex,
      mapLocation: mode === 'puerta' ? location : null
    };
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
    const snapshot = await waitForSession();
    if (snapshot.status === AUTH_STATES.UNKNOWN) {
      throw appError('session_unknown', 'No pudimos verificar tu sesión todavía. Esperá un momento y reintentá.');
    }
    const user = snapshot.user;
    if (!user || user.isAnonymous || !user.emailVerified) {
      throw appError('login_required', 'Necesitás iniciar sesión con un correo verificado.');
    }

    const items = await readyCartItems();
    if (!items.length) throw appError('empty_cart', 'Tu carrito está vacío.');

    const [settingsSnap, shippingRatesSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'general')),
      getDoc(doc(db, 'settings', 'shippingRates'))
    ]);
    if (!settingsSnap.exists()) {
      throw appError('settings_missing', 'No pudimos comprobar la configuración de la tienda.');
    }
    const settings = mergeShippingRates(settingsSnap.data() || {}, shippingRatesSnap);
    const citySelect = document.getElementById('ck-city');
    const selectedCity = text(citySelect?.value);
    const selectedDepartamentoRaw = text(document.getElementById('ck-departamento')?.value);
    const selectedDepartamento = selectedDepartamentoRaw === '__retiro__' ? '' : selectedDepartamentoRaw;
    const selectedOption = citySelect?.options?.[citySelect.selectedIndex];
    const selectedGroupId = selectedOption?.parentElement?.id || '';
    const requestedShippingMethod = selectedCity === '__retiro__'
      ? 'retiro'
      : selectedGroupId === 'ck-city-delivery-group'
        ? 'delivery'
        : selectedGroupId === 'ck-city-encomienda-group'
          ? 'encomienda'
          : '';
    if (!requestedShippingMethod) {
      throw appError('shipping_invalid', 'Volvé a elegir tu ciudad y método de entrega.');
    }
    const shipping = resolveShipping(
      settings,
      selectedCity,
      selectedDepartamento,
      requestedShippingMethod,
      mapLocation()
    );
    const name = text(document.getElementById('ck-name')?.value);
    const address = text(document.getElementById('ck-address')?.value);
    const reference = text(document.getElementById('ck-referencia')?.value);
    if (shipping.method === 'delivery' && reference.length < 5) {
      throw appError('reference_required', 'Ingresá una referencia útil para encontrar tu entrega (al menos 5 caracteres).');
    }
    const paymentMethod = text(document.querySelector('input[name="ck-pay"]:checked')?.value);

    if (!isValidCustomerName(name)) throw appError('name_required', 'Ingresá tu nombre y apellido (al menos dos palabras).');
    if (!['efectivo', 'transferencia', 'paypal'].includes(paymentMethod)) {
      throw appError('payment_required', 'Seleccioná un método de pago disponible.');
    }
    if ((shipping.method === 'encomienda' && paymentMethod !== 'transferencia') || (paymentMethod === 'efectivo' && shipping.method !== 'delivery')) {
      throw appError('payment_unavailable', 'El producto por encomienda se paga previamente por transferencia. Efectivo contra entrega sólo para delivery.');
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

    const ciRaw = text(document.getElementById('ck-ci')?.value);
    if (shipping.method === 'encomienda' && !isValidCi(ciRaw)) {
      throw appError('ci_invalid', 'Ingresá tu cédula de identidad (solo números, 5 a 8 dígitos).');
    }
    const wantsInvoice = document.getElementById('ck-wants-invoice')?.checked === true;
    const taxpayerType = text(document.getElementById('ck-taxpayer-type')?.value);
    if (wantsInvoice && !isValidTaxpayerType(taxpayerType)) {
      throw appError('taxpayer_type_required', 'Elegí el tipo de contribuyente para tu factura.');
    }
    const razonSocial = text(document.getElementById('ck-razon-social')?.value);
    const rucRaw = text(document.getElementById('ck-ruc')?.value);
    if (wantsInvoice && (taxpayerType === 'fisica' ? !isValidCustomerName(razonSocial) : !isValidRazonSocial(razonSocial))) {
      throw appError('razon_social_required', 'Ingresá nombre y apellido para persona física, o la razón social de tu empresa.');
    }
    if (wantsInvoice && !isValidRuc(rucRaw)) {
      throw appError('ruc_invalid', 'Ingresá un RUC válido, con guion y dígito verificador (ej: 80012345-6).');
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
      subtotal: localSubtotal,
      ci: shipping.method === 'encomienda' ? normalizeCi(ciRaw) : '',
      wantsInvoice,
      taxpayerType,
      razonSocial: wantsInvoice ? razonSocial : '',
      ruc: wantsInvoice ? normalizeRuc(rucRaw) : '',
      couponCode: document.getElementById('ck-coupon')?.dataset.applied || ''
    });
  }

  function cartLineKey(item) {
    return `${String(item?.id ?? '')}\u241f${text(item?.variant)}`;
  }

  function authoritativeCartFromQuote(quote) {
    const currentByLine = new Map(getCartLocal().map(item => [cartLineKey(item), item]));
    return (quote.items || []).map(item => ({
      ...(currentByLine.get(cartLineKey(item)) || {}),
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

  function renderQuote(quote, shippingMethod) {
    setCartLocal(authoritativeCartFromQuote(quote));
    const target = document.getElementById('ck-summary-quote') || document.getElementById('ck-confirm-summary');
    if (!target) return;
    target.innerHTML = `
      <div class="ck-summary-items">${(quote.items || []).map(item => `
        <div class="ck-summary-item">
          <span class="ck-summary-item-name">${escapeHtml(item.qty)}x ${escapeHtml(item.name)}</span>
          <span style="font-weight:700">${escapeHtml(formatPrice(item.price * item.qty))}</span>
        </div>`).join('')}</div>
      <div class="ck-summary-total" style="margin-top:16px"><span>Subtotal</span><span class="ck-summary-total-val">${escapeHtml(formatPrice(quote.subtotal))}</span></div>
      <div class="ck-summary-total"><span>Costo de envío</span><span class="ck-summary-total-val">${shippingMethod === 'encomienda' ? 'Sólo el envío: se paga a la transportadora al recibir' : quote.shippingPending ? 'A confirmar' : escapeHtml(formatPrice(quote.shippingCost || 0))}</span></div>
      <div class="ck-summary-total" style="font-size:18px"><span>${escapeHtml(`TOTAL${quote.shippingPending ? ' (+ envío)' : ''}`)}</span><span class="ck-summary-total-val">${escapeHtml(formatPrice(quote.total))}</span></div>`;
  }

  async function reserveCheckoutGuard(draft) {
    const user = getSessionUser();
    if (!user) throw appError('session_unknown', 'No pudimos verificar tu sesión todavía. Esperá un momento y reintentá.');
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
    paypal: 'PayPal',
  };

  function shippingSummary(draft) {
    const method = text(draft?.shippingMethod);
    const base = SHIPPING_LABELS[method] || method || 'A coordinar';
    const mode = ENCOMIENDA_LABELS[text(draft?.encomiendaMode)];
    return mode ? `${base} — ${mode}` : base;
  }

  function buildWhatsAppMessage(result, draft) {
    const itemLines = (result.items || [])
      .map(item => `• ${item.qty}x ${item.name} — ${formatPrice(item.price * item.qty)}`)
      .join('\n');
    const shippingText = draft?.shippingMethod === 'encomienda'
      ? 'Sólo el costo del envío se paga a la transportadora al recibir; el producto se paga previamente por transferencia'
      : result.shippingPending
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
    const ci = text(draft?.ci);
    if (ci) lines.push(`🪪 CI: ${ci}`);
    if (draft?.wantsInvoice) {
      lines.push(`🧾 Factura — Razón social: ${text(draft?.razonSocial)} — RUC: ${text(draft?.ruc)}`);
    }

    const name = text(draft?.name);
    if (name) lines.push('', `👤 ${name}`);
    const phone = text(draft?.phone);
    if (phone) lines.push(`📱 ${phone}`);

    return lines.join('\n');
  }

  function success(result, draft) {
    window._lastOrderId = result.shortId;
    window.TintinCheckoutOrderCompleted = true;
    try {
      window.history.pushState(
        { ...(window.history.state || {}), tintinOrderCompleted: true },
        '',
        window.location.href,
      );
    } catch {}
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

  window.addEventListener('popstate', () => {
    if (!window.TintinCheckoutOrderCompleted) return;
    window.location.replace('/');
  });

  function message(error) {
    const code = error?.details?.code || error?.code || error?.message;
    const messages = {
      empty_cart: 'Tu carrito está vacío.',
      name_required: 'Ingresá tu nombre y apellido (al menos dos palabras).',
      phone_invalid: 'Ingresá un teléfono o WhatsApp válido.',
      payment_required: 'Seleccioná un método de pago.',
      map_required: 'Marcá y nombrá tu ubicación en el mapa.',
      reference_required: 'Ingresá una referencia útil para encontrar tu entrega (al menos 5 caracteres).',
      taxpayer_type_required: 'Elegí el tipo de contribuyente para tu factura.',
      address_required: 'Ingresá la dirección para la encomienda.',
      ci_invalid: 'Ingresá tu cédula de identidad (solo números, 5 a 8 dígitos).',
      razon_social_required: 'Ingresá nombre y apellido para persona física, o la razón social de tu empresa.',
      ruc_invalid: 'Ingresá un RUC válido, con guion y dígito verificador (ej: 80012345-6).',
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
      coupon_invalid: 'El código del cupón no es válido.',
      coupon_not_found: 'El cupón no existe.',
      coupon_inactive: 'El cupón no está activo.',
      coupon_not_started: 'El cupón todavía no está vigente.',
      coupon_expired: 'El cupón venció. Quitalo para continuar sin descuento.',
      coupon_exhausted: 'El cupón ya alcanzó su límite de usos. Quitalo para continuar.',
      coupon_customer_limit: 'Ya usaste este cupón el máximo de veces permitido. Quitalo para continuar.',
      coupon_not_applicable: 'El cupón de envío gratis solo aplica a delivery con costo.',
      quote_changed: 'Cambió un precio o el costo de envío. Confirmá de nuevo para continuar con los valores actuales.',
      order_state_invalid: 'Este pedido ya no puede reanudarse. Volvé a intentar desde el carrito.',
      checkout_guard_missing: 'No pudimos confirmar tu turno de compra. Volvé a intentar.',
      checkout_guard_expired: 'Pasó demasiado tiempo desde que confirmaste. Volvé a intentar.',
      missing_id_token: 'Necesitás iniciar sesión con un correo verificado.',
      invalid_id_token: 'Tu sesión expiró. Volvé a ingresar e intentá de nuevo.',
      token_verify_failed: 'No pudimos verificar tu sesión. Volvé a intentar.',
      email_not_verified: 'Necesitás verificar tu correo antes de comprar.',
      network_error: 'No pudimos conectar con la tienda. Tus productos siguen en el carrito; revisá tu conexión y reintentá.',
      server_timeout: 'La confirmación está tardando. Reintentá: se conserva el mismo pedido para evitar duplicados.',
      invalid_response: 'La tienda no devolvió una confirmación válida. Tus productos siguen en el carrito; reintentá.',
      session_unknown: 'Todavía no pudimos verificar tu sesión. Esperá un momento y reintentá.',
      profile_incomplete: 'Completá tu nombre y WhatsApp en tu cuenta antes de confirmar.',
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

    let draft;
    try {
      draft = await buildDraft();
      try {
        await persistCheckoutDefaults(draft);
      } catch (profileError) {
        console.warn('[secure-checkout-order] El pedido continúa, pero no se pudieron guardar CI/facturación:', profileError);
      }
      await reserveCheckoutGuard(draft);
      const result = await createOrderOnServer(draft);
      if (draft.paymentMethod === 'paypal') {
        pendingPaypal = { result, draft };
        button.style.display = 'none';
        document.getElementById('tt-paypal-checkout')?.style.setProperty('display', 'block');
        window.dispatchEvent(new CustomEvent('tintin:paypal-order-ready', {
          detail: { orderId: result.orderId, shortId: result.shortId, total: result.total, result, draft }
        }));
        return;
      }
      orderCompleted = true;
      try {
        await clearCart();
      } catch (clearError) {
        console.warn('[secure-checkout-order] El pedido se creó, pero no se pudo limpiar el carrito local:', clearError);
      }
      try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
      inMemoryRequestId = null;
      success(result, draft);
    } catch (error) {
      console.error('[spark-checkout]', error);
      const code = error?.details?.code || error?.code;
      if (code === 'quote_changed' && error.details?.quote) {
        renderQuote(error.details.quote, draft?.shippingMethod);
        showError('Cambió un precio o el costo de envío. Revisá el resumen actualizado y confirmá nuevamente.');
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido actualizado';
      } else if (code === 'insufficient_stock') {
        const productId = String(error.details?.productId || '');
        const available = Number(error.details?.available || 0);
        const variant = String(error.details?.variant || '');
        setCartLocal(
          getCartLocal()
            .map(item => String(item.id) === productId && (!variant || String(item.variant || '').split('/').map(part => part.trim()).join(' / ') === variant)
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
      } else if (code === 'empty_cart') {
        forceBackToCart();
        button.textContent = '✓ Confirmar pedido';
      } else {
        showError(message(error));
        button.disabled = false;
        button.textContent = '✓ Confirmar pedido';
      }
    } finally {
      submitting = false;
    }
  }

  window.addEventListener('tintin:paypal-payment-completed', async event => {
    if (orderCompleted || !pendingPaypal) return;
    const { result, draft } = pendingPaypal;
    if (event.detail?.orderId !== result.orderId) return;
    orderCompleted = true;
    pendingPaypal = null;
    try { await clearCart(); } catch (error) { console.warn('[secure-checkout-order] No se pudo limpiar el carrito tras PayPal:', error); }
    try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
    inMemoryRequestId = null;
    document.getElementById('tt-paypal-checkout')?.style.setProperty('display', 'none');
    success(result, draft);
  });

  window.addEventListener('click', event => {
    const button = event.target?.closest?.('#ck-confirm-btn');
    if (!button || button.style.display === 'none') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    submit(button);
  }, true);
}
