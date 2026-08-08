// =============================================================
// TINTIN — Enlace directo desde la notificación al pedido
// =============================================================
// La notificación abre /admin.html?section=pedidos&order=<orderId>.
// La sección la resuelve el deep-link que ya tiene js/admin/admin-app.js
// (?section=…), con todos sus chequeos de permisos. Este módulo se ocupa
// sólo del parámetro `order`: espera a que los pedidos estén cargados y
// abre el pedido con el mismo openOrderEdit() del panel.
//
// El parámetro no ejecuta ninguna acción administrativa: como máximo abre
// un editor que el propio panel ya restringe por rol, y sólo después de
// que la sesión esté autenticada y los pedidos leídos desde Firestore.

const PENDING_KEY = 'tt_push_pending_order';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{12,220}$/;
const POLL_INTERVAL_MS = 400;
const MAX_POLLS = 60; // 24 s como máximo: después se deja de esperar.

function readPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.at || 0) > PENDING_MAX_AGE_MS) return '';
    return ORDER_ID_PATTERN.test(String(parsed.orderId || '')) ? parsed.orderId : '';
  } catch {
    return '';
  }
}

function savePending(orderId) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ orderId, at: Date.now() })); } catch {}
}

function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
}

function requestedOrderId() {
  const fromUrl = new URLSearchParams(location.search).get('order') || '';
  if (ORDER_ID_PATTERN.test(fromUrl)) return fromUrl;
  return readPending();
}

function notify(message) {
  const detail = document.getElementById('push-status-detail');
  if (detail) detail.textContent = message;
  else console.info('[Tintin] %s', message);
}

function openWhenReady(orderId) {
  let polls = 0;
  const timer = window.setInterval(() => {
    polls += 1;
    const orders = window.TintinAdminOrders;
    if (polls > MAX_POLLS) {
      window.clearInterval(timer);
      clearPending();
      notify('No se pudo abrir el pedido de la notificación: probá desde la lista de Pedidos.');
      return;
    }
    if (!orders || typeof window.openOrderEdit !== 'function' || !orders.ready()) return;

    window.clearInterval(timer);
    clearPending();
    if (!orders.has(orderId)) {
      notify('El pedido de la notificación ya no existe o fue eliminado.');
      return;
    }
    window.openOrderEdit(orderId);
  }, POLL_INTERVAL_MS);
}

function boot() {
  const orderId = requestedOrderId();
  if (!orderId) return;
  // Se guarda antes de esperar: si la sesión venció y el panel manda a
  // login.html, al volver se retoma el mismo destino.
  savePending(orderId);
  openWhenReady(orderId);
}

// El service worker puede pedirle a una ventana ya abierta que navegue al
// pedido cuando el navegador no admite client.navigate().
navigator.serviceWorker?.addEventListener?.('message', event => {
  const data = event?.data;
  if (data?.type !== 'tintin-push-navigate' || typeof data.url !== 'string') return;
  if (!data.url.startsWith('/admin.html?')) return;
  location.href = data.url;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
