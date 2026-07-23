const ACTIVITY_KEY = 'tt_cart_activity_v1';
const SESSION_KEY = 'tt_cart_recovery_shown_v1';
const RETURN_AFTER_MS = 30 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Para una clienta logueada, el primer tt_cart_updated es el carrito local
// (antes de que el listener de Firestore traiga el carrito ya fusionado
// entre dispositivos); ese primer evento puede no ser el definitivo. En vez
// de decidir solo con ese primero, seguimos mirando cualquier evento que
// llegue dentro de esta ventana de "asentamiento" tras cargar la página —
// ningún cambio real de la clienta ocurre tan rápido, así que no confundimos
// una compra en curso con el carrito recuperado.
const SETTLE_WINDOW_MS = 4000;

const pageLoadedAt = Date.now();
let initialActivity = readActivity();
let lastProjection = '';

function readActivity() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const updatedAt = Number(parsed.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    return {
      updatedAt,
      hadItems: parsed.hadItems === true,
      projection: String(parsed.projection || '').slice(0, 500)
    };
  } catch {
    return null;
  }
}

function summarize(items) {
  const normalized = Array.isArray(items) ? items : [];
  return normalized.reduce((summary, item) => {
    const qty = Math.max(0, Math.min(99, Math.floor(Number(item?.qty) || 0)));
    const price = Math.max(0, Number(item?.price) || 0);
    if (!qty) return summary;
    summary.lines += 1;
    summary.quantity += qty;
    summary.value += qty * price;
    summary.ids.push(`${String(item?.id || '').slice(0, 80)}:${String(item?.variant || '').slice(0, 60)}:${qty}`);
    return summary;
  }, { lines: 0, quantity: 0, value: 0, ids: [] });
}

function projectionFor(summary) {
  return summary.ids.sort().join('|').slice(0, 500);
}

function remember(summary) {
  const projection = projectionFor(summary);
  lastProjection = projection;
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify({
      updatedAt: Date.now(),
      hadItems: summary.quantity > 0,
      projection
    }));
  } catch {}
}

function shownThisSession() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markShown() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
}

function ensureStyles() {
  if (document.getElementById('tt-cart-recovery-style')) return;
  const style = document.createElement('style');
  style.id = 'tt-cart-recovery-style';
  style.textContent = `
    .tt-cart-recovery-toast {
      position: fixed;
      z-index: 2147482000;
      left: 50%;
      bottom: max(88px, calc(env(safe-area-inset-bottom, 0px) + 76px));
      width: min(calc(100vw - 32px), 390px);
      transform: translate(-50%, 18px);
      padding: 12px 42px 12px 14px;
      border: 1px solid rgba(173,63,103,.18);
      border-radius: 14px;
      background: #fff;
      color: #4d2837;
      box-shadow: 0 16px 44px rgba(73,35,49,.18);
      font: 600 13px/1.45 Montserrat, sans-serif;
      opacity: 0;
      pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
    }
    .tt-cart-recovery-toast.is-visible { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
    .tt-cart-recovery-toast button {
      position: absolute;
      top: 50%;
      right: 8px;
      width: 34px;
      height: 34px;
      margin: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font: 700 18px/1 Montserrat, sans-serif;
      transform: translateY(-50%);
      cursor: pointer;
    }
    .tt-cart-recovery-toast button:focus-visible { outline: 3px solid rgba(173,63,103,.35); outline-offset: 1px; }
    @media (min-width: 769px) {
      .tt-cart-recovery-toast { left: auto; right: 24px; bottom: 24px; transform: translateY(18px); }
      .tt-cart-recovery-toast.is-visible { transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .tt-cart-recovery-toast { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

function announceRestored(summary) {
  if (!document.body || shownThisSession()) return;
  markShown();
  ensureStyles();

  const toast = document.createElement('div');
  toast.className = 'tt-cart-recovery-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.textContent = summary.quantity === 1
    ? 'Recuperamos el producto que habías guardado en tu carrito.'
    : `Recuperamos los ${summary.quantity} productos que habías guardado en tu carrito.`;

  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.textContent = '×';
  toast.appendChild(close);
  document.body.appendChild(toast);

  const remove = () => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  };
  close.addEventListener('click', remove, { once: true });
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(remove, 6500);

  window.dispatchEvent(new CustomEvent('tintin:cart-restored', {
    detail: {
      lines: summary.lines,
      quantity: summary.quantity,
      value: Math.max(0, Math.round(summary.value))
    }
  }));
}

function onCartUpdated(event) {
  const summary = summarize(event?.detail?.items);
  const projection = projectionFor(summary);

  if (initialActivity && Date.now() - pageLoadedAt <= SETTLE_WINDOW_MS) {
    const age = Date.now() - initialActivity.updatedAt;
    const validAge = age >= RETURN_AFTER_MS && age <= MAX_AGE_MS;
    const sameSavedCart = initialActivity.hadItems && initialActivity.projection === projection;
    if (summary.quantity > 0 && validAge && sameSavedCart) {
      announceRestored(summary);
      initialActivity = null;
    }
  } else {
    initialActivity = null;
  }

  if (projection !== lastProjection) remember(summary);
}

if (!/\/(?:admin|admin-images)\.html$/i.test(window.location.pathname || '')) {
  window.addEventListener('tt_cart_updated', onCartUpdated, { passive: true });
}
