import { hasForwardValidation, replayValidatedForward } from './validacion-avance.js?v=tintin-20261007-checkout-guards-1';
import {
  awaitCartReady,
  getCartLocal,
  updateQty,
  removeFromCart,
} from '../../components/cart/sincronizacion-carrito.js?v=tintin-20261008-producto-superficies-1';
import { AUTH_STATES, subscribeSession, waitForSession } from '../../core/auth/coordinador-sesion.js?v=tintin-20260924-auth-state-authority-1-auth-popup-resolver-1-launch-20260926-1';
import { readCheckoutProfile } from './perfil-checkout.js?v=tintin-20261007-checkout-session-1';

const CHECKOUT_PATH = /(^|\/)checkout(?:\.html)?\/?$/i;
const RESUME_KEY = 'tt_checkout_resume_step';
const RESUME_BACKUP_KEY = 'tt_checkout_resume_step_backup_v2';
const FORWARD_SELECTOR = '#btn-step1-next,#btn-step2-next,#btn-step3-next,#btn-step4-next,#ck-confirm-btn';
const pendingControls = new WeakSet();

let cartReady = false;
let profilePromise = Promise.resolve({ ok: false, reason: 'auth_unknown' });
let profileState = { ok: false, loading: true, user: null, profile: null, reason: 'loading' };
let profileGeneration = 0;
let annotateQueued = false;
const CART_READY_TIMEOUT_MS = 2500;

function waitForCheckoutCartReady() {
  return Promise.race([
    Promise.resolve().then(() => awaitCartReady()),
    new Promise(resolve => window.setTimeout(resolve, CART_READY_TIMEOUT_MS))
  ]);
}

function activeStep() {
  return [...document.querySelectorAll('.ck-panel')].findIndex(panel => panel.classList.contains('active'));
}

function errorBox(step = 0) {
  return document.getElementById(`error-${step}`);
}

function showError(message, step = 0) {
  const box = errorBox(step);
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
  box.setAttribute('role', 'alert');
}

function forceCart(message = '') {
  document.querySelectorAll('.ck-panel').forEach((panel, index) => {
    panel.classList.toggle('active', index === 0);
  });
  document.querySelectorAll('.ck-step').forEach((step, index) => {
    step.classList.toggle('active', index === 0);
    step.classList.remove('done');
  });
  const confirm = document.getElementById('ck-confirm-btn');
  if (confirm) {
    confirm.dataset.ttCartGuardDisabled = '1';
    confirm.disabled = true;
  }
  if (message) showError(message, 0);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function syncConfirmCartGuard() {
  const confirm = document.getElementById('ck-confirm-btn');
  if (!confirm) return;
  const hasItems = getCartLocal().length > 0;
  if (!hasItems) {
    confirm.dataset.ttCartGuardDisabled = '1';
    confirm.disabled = true;
    return;
  }
  delete confirm.dataset.ttCartGuardDisabled;
  const blockedElsewhere =
    confirm.dataset.ttQuotaDisabled === '1' ||
    confirm.dataset.ttMaintenanceLocked === '1' ||
    document.body?.classList.contains('tt-checkout-submitting');
  if (!blockedElsewhere) confirm.disabled = false;
}

function mirrorResumeState() {
  try {
    const value = sessionStorage.getItem(RESUME_KEY);
    if (value != null) sessionStorage.setItem(RESUME_BACKUP_KEY, value);
  } catch {}
}

function restoreResumeState() {
  try {
    if (sessionStorage.getItem(RESUME_KEY) != null) return;
    const backup = sessionStorage.getItem(RESUME_BACKUP_KEY);
    if (backup != null) sessionStorage.setItem(RESUME_KEY, backup);
  } catch {}
}

function eventuallyClearResumeBackup() {
  window.setTimeout(() => {
    try {
      const main = sessionStorage.getItem(RESUME_KEY);
      if (main == null && activeStep() > 0) sessionStorage.removeItem(RESUME_BACKUP_KEY);
    } catch {}
  }, 2500);
}

async function loadProfile(user) {
  const generation = ++profileGeneration;
  const staleResult = () => ({ ok: false, loading: false, user: null, profile: null, reason: 'session_changed' });
  if (!user || user.isAnonymous) {
    profileState = { ok: false, loading: false, user: user || null, profile: null, reason: 'signed_out' };
    return profileState;
  }
  if (!user.emailVerified) {
    profileState = { ok: false, loading: false, user, profile: null, reason: 'email_not_verified' };
    return profileState;
  }
  profileState = { ok: false, loading: true, user, profile: null, reason: 'loading' };
  try {
    const profile = await readCheckoutProfile(user);
    if (generation !== profileGeneration) return staleResult();
    if (!profile) {
      profileState = { ok: false, loading: false, user, profile: null, reason: 'profile_missing' };
    } else if (profile.blocked === true) {
      profileState = { ok: false, loading: false, user, profile, reason: 'blocked' };
    } else {
      profileState = { ok: true, loading: false, user, profile, reason: '' };
    }
  } catch (error) {
    if (generation !== profileGeneration) return staleResult();
    console.error('[checkout-hardening] No se pudo validar el perfil:', error);
    profileState = { ok: false, loading: false, user, profile: null, reason: 'profile_error' };
  }
  return profileState;
}

function profileMessage(state) {
  if (state.reason === 'auth_unknown') return 'No pudimos verificar tu sesión todavía. Esperá un momento y reintentá.';
  if (state.reason === 'blocked') return 'Tu cuenta está bloqueada para comprar. Contactanos por WhatsApp si necesitás ayuda.';
  if (state.reason === 'email_not_verified') return 'Verificá tu correo antes de continuar con la compra.';
  if (state.reason === 'profile_missing' || state.reason === 'profile_error') return 'No pudimos cargar los datos de tu cuenta. Recargá la página e intentá nuevamente.';
  return 'Iniciá sesión para continuar con tu compra.';
}

function annotateCityOptions() {
  const department = document.getElementById('ck-departamento')?.value || '';
  const city = document.getElementById('ck-city');
  if (!city) return;
  city.querySelectorAll('#ck-city-delivery-group option').forEach(option => {
    option.dataset.method = 'delivery';
    option.dataset.departamento = department || 'Central';
  });
  city.querySelectorAll('#ck-city-encomienda-group option').forEach(option => {
    option.dataset.method = 'encomienda';
    option.dataset.departamento = department || 'Central';
  });
  city.querySelectorAll(`option[value="__retiro__"]`).forEach(option => {
    option.dataset.method = 'retiro';
    option.dataset.departamento = 'Central';
  });
}

function annotateCartRows() {
  const root = document.getElementById('ck-items');
  if (!root) return;
  const queues = new Map();
  getCartLocal().forEach(item => {
    const key = String(item.id ?? '');
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(item);
  });

  root.querySelectorAll('.ck-item').forEach(row => {
    const id = String(row.dataset.id || '');
    const line = queues.get(id)?.shift();
    if (!line) return;
    row.dataset.lineId = String(line.lineId || line.id || id);
    const variant = String(line.variant || '').trim();
    const existing = row.querySelector('[data-cart-variant]');
    if (!variant) {
      existing?.remove();
      return;
    }
    if (existing) {
      // La lista observa childList. Reescribir el mismo texto genera otra
      // mutación y encola esta normalización de nuevo, sin dejar pintar ni
      // responder al siguiente clic cuando el carrito tiene variantes.
      if (existing.textContent !== variant) existing.textContent = variant;
      if (existing.dataset.cartVariant !== variant) existing.dataset.cartVariant = variant;
      return;
    }
    const cat = row.querySelector('.ck-item-cat');
    const node = document.createElement('div');
    node.className = 'ck-item-cat';
    node.dataset.cartVariant = variant;
    node.textContent = variant;
    cat?.insertAdjacentElement('afterend', node);
  });
}

function scheduleAnnotations() {
  if (annotateQueued) return;
  annotateQueued = true;
  queueMicrotask(() => {
    annotateQueued = false;
    annotateCityOptions();
    annotateCartRows();
    syncConfirmCartGuard();
  });
}

async function guardForwardClick(event, control) {
  if (hasForwardValidation(event, control, 'profile')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();

  if (pendingControls.has(control)) return;
  pendingControls.add(control);
  try {
    // La capa de captura también debe esperar al coordinador. Antes cancelaba
    // el handler original y trataba un clic durante RESTORING como error,
    // obligando a la visitante a clicar nuevamente para ver el acceso.
    await waitForSession();
    if (profileState.reason === 'signed_out') {
      // La identidad ausente ya es definitiva: pedir acceso directamente.
      // El handler original conserva la comprobación del carrito local;
      // no hay una sincronización remota de invitada que esperar.
      replayValidatedForward(control, event, 'profile');
      mirrorResumeState();
      return;
    }

    // El paso de envío usa la copia local del carrito. Si la sincronización
    // remota o App Check no responden, no se debe congelar el botón inicial.
    await waitForCheckoutCartReady();
    cartReady = true;
    scheduleAnnotations();

    if (!getCartLocal().length) {
      forceCart('Tu carrito está vacío. Agregá productos antes de continuar.');
      return;
    }

    const pendingProfile = profilePromise;
    const state = await profilePromise;
    if (pendingProfile !== profilePromise) {
      showError('Tu sesión cambió. Reintentá para continuar con la cuenta actual.', Math.max(0, activeStep()));
      return;
    }
    if (!state.ok) {
      // El primer avance solo abre el formulario de envío. Si la lectura
      // secundaria del perfil falla (red, reglas o timeout de Firestore), no
      // hay motivo para dejar el carrito inutilizable: el control de cuenta
      // bloqueada/login se mantiene en el flujo original y en la confirmación.
      if (
        control.id === 'btn-step1-next' &&
        (state.reason === 'profile_error' || state.reason === 'profile_missing')
      ) {
        replayValidatedForward(control, event, 'profile');
        return;
      }
      if (state.reason === 'auth_unknown') {
        showError(profileMessage(state), 0);
        return;
      }
      if (state.reason === 'signed_out') {
        // Dejar que el checkout original abra su modal de acceso, pero con el
        // carrito ya resuelto y sin permitir que una carga incompleta lo saltee.
        replayValidatedForward(control, event, 'profile');
        mirrorResumeState();
        return;
      }
      forceCart(profileMessage(state));
      return;
    }

    replayValidatedForward(control, event, 'profile');
  } finally {
    pendingControls.delete(control);
  }
}

async function handleCartControl(event, button) {
  const row = button.closest('.ck-item');
  const lineId = row?.dataset.lineId;
  if (!lineId) return false;
  const action = button.dataset.action || button.dataset.cartAction || '';
  if (!['plus', 'minus', 'remove'].includes(action)) return false;

  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
  if (action === 'remove') await removeFromCart(lineId);
  else await updateQty(lineId, action === 'plus' ? 1 : -1);
  scheduleAnnotations();
  return true;
}

function boot() {
  if (!CHECKOUT_PATH.test(location.pathname)) return;

  restoreResumeState();
  [50, 180, 600, 1200].forEach(delay => window.setTimeout(restoreResumeState, delay));
  window.addEventListener('pageshow', restoreResumeState);
  window.addEventListener('focus', restoreResumeState);
  window.addEventListener('pagehide', mirrorResumeState);

  document.addEventListener('click', event => {
    const accessLink = event.target?.closest?.('a[href*="login"],a[href*="registro"],a[href*="register"]');
    if (accessLink) mirrorResumeState();
  }, true);

  // No observar el primer `null` antes de que Firebase restaure la sesión:
  // ese pulso transitorio hacía que checkout tratara a una cuenta persistida
  // como invitada al venir desde el carrito/header.
  subscribeSession(snapshot => {
    if (snapshot.status === AUTH_STATES.RESTORING) return;
    restoreResumeState();
    if (snapshot.status === AUTH_STATES.UNKNOWN) {
      profileGeneration++;
      profileState = { ok: false, loading: false, user: null, profile: null, reason: 'auth_unknown' };
      profilePromise = Promise.resolve(profileState);
      return;
    }
    profilePromise = loadProfile(snapshot.user);
    profilePromise.then(state => {
      if (state.ok) {
        restoreResumeState();
        eventuallyClearResumeBackup();
      }
    });
  });

  document.addEventListener('click', event => {
    const cartButton = event.target?.closest?.('#ck-items .ck-qty-btn,#ck-items .ck-remove-btn');
    if (cartButton) {
      void handleCartControl(event, cartButton);
      return;
    }
    const control = event.target?.closest?.(FORWARD_SELECTOR);
    if (control) void guardForwardClick(event, control);
  }, true);

  document.getElementById('ck-departamento')?.addEventListener('change', () => window.setTimeout(annotateCityOptions, 0));
  const city = document.getElementById('ck-city');
  if (city) new MutationObserver(scheduleAnnotations).observe(city, { childList: true, subtree: true });
  const items = document.getElementById('ck-items');
  if (items) new MutationObserver(scheduleAnnotations).observe(items, { childList: true, subtree: true });

  window.addEventListener('tt_cart_updated', event => {
    scheduleAnnotations();
    const nextItems = Array.isArray(event.detail?.items) ? event.detail.items : getCartLocal();
    if (!nextItems.length && activeStep() > 0) forceCart('Tu carrito quedó vacío. Agregá productos para continuar.');
  });
  window.addEventListener('tintin:products-loaded', scheduleAnnotations);
  window.addEventListener('tintin:checkout-quota-ended', syncConfirmCartGuard);

  void waitForCheckoutCartReady().then(() => {
    cartReady = true;
    scheduleAnnotations();
    if (!getCartLocal().length && activeStep() > 0) forceCart('Tu carrito está vacío.');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

window.TintinCheckoutHardening = {
  get cartReady() { return cartReady; },
  get profileState() { return { ...profileState }; },
  annotate: scheduleAnnotations,
};
